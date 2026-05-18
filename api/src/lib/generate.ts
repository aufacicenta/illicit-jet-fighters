import { aiModels } from "./ai-models";
import { logger } from "./logger";
import { openrouter } from "./openrouter";
import { skills } from "./skills";
import type { ChatMessage } from "./types";

const getText = (content: unknown): string => {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    const textParts = content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (typeof part === "object" && part && "text" in part) {
          const maybeText = part.text;
          return typeof maybeText === "string" ? maybeText : "";
        }

        return "";
      })
      .filter(Boolean);

    return textParts.join("\n").trim();
  }

  return "";
};

type SpecsheetImagePart = {
  type?: string;
  imageUrl: string;
};

const getImageUrl = (image: Record<string, unknown>): string | undefined => {
  if ("image_url" in image) {
    const imageUrlValue = image.image_url;
    if (
      imageUrlValue &&
      typeof imageUrlValue === "object" &&
      "url" in imageUrlValue &&
      typeof imageUrlValue.url === "string"
    ) {
      return imageUrlValue.url;
    }
  }

  if ("imageUrl" in image) {
    const imageUrlValue = image.imageUrl;
    if (
      imageUrlValue &&
      typeof imageUrlValue === "object" &&
      "url" in imageUrlValue &&
      typeof imageUrlValue.url === "string"
    ) {
      return imageUrlValue.url;
    }
  }

  if ("url" in image && typeof image.url === "string") {
    return image.url;
  }

  return undefined;
};

const buildSpecsheetImageDiagnostic = (completion: unknown) => {
  if (!completion || typeof completion !== "object") {
    return {
      completionType: typeof completion,
      hasChoices: false,
    };
  }

  const withChoices = completion as { choices?: unknown; usage?: unknown };
  const choices = withChoices.choices;
  const firstChoice = Array.isArray(choices) && choices.length > 0 ? choices[0] : undefined;
  const firstMessage =
    firstChoice && typeof firstChoice === "object" && "message" in firstChoice
      ? firstChoice.message
      : undefined;
  const images =
    firstMessage && typeof firstMessage === "object" && "images" in firstMessage
      ? firstMessage.images
      : undefined;
  const content =
    firstMessage && typeof firstMessage === "object" && "content" in firstMessage
      ? firstMessage.content
      : undefined;
  const finishReason =
    firstChoice && typeof firstChoice === "object"
      ? "finishReason" in firstChoice
        ? firstChoice.finishReason
        : "finish_reason" in firstChoice
          ? firstChoice.finish_reason
          : undefined
      : undefined;

  return {
    completionKeys: Object.keys(completion),
    hasChoices: Array.isArray(choices),
    choicesCount: Array.isArray(choices) ? choices.length : 0,
    firstChoiceKeys: firstChoice && typeof firstChoice === "object" ? Object.keys(firstChoice) : [],
    finishReason,
    hasMessage: Boolean(firstMessage && typeof firstMessage === "object"),
    messageKeys:
      firstMessage && typeof firstMessage === "object" ? Object.keys(firstMessage) : undefined,
    imagesCount: Array.isArray(images) ? images.length : 0,
    firstImageKeys:
      Array.isArray(images) &&
      images[0] &&
      typeof images[0] === "object" &&
      !Array.isArray(images[0])
        ? Object.keys(images[0] as Record<string, unknown>)
        : [],
    contentType: typeof content,
    contentPreview:
      typeof content === "string" ? content.slice(0, 180) : Array.isArray(content) ? "array" : "",
    usage: withChoices.usage,
  };
};

const getSpecsheetImage = (completion: unknown): SpecsheetImagePart | undefined => {
  if (!completion || typeof completion !== "object" || !("choices" in completion)) {
    return undefined;
  }

  const choices = completion.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return undefined;
  }

  const firstChoice = choices[0];
  if (!firstChoice || typeof firstChoice !== "object" || !("message" in firstChoice)) {
    return undefined;
  }

  const message = firstChoice.message;
  if (!message || typeof message !== "object" || !("images" in message)) {
    return undefined;
  }

  const images = message.images;
  if (!Array.isArray(images) || images.length === 0) {
    return undefined;
  }

  const image = images[0];
  if (!image || typeof image !== "object") {
    return undefined;
  }

  const imageUrl = getImageUrl(image as Record<string, unknown>);
  if (!imageUrl) {
    return undefined;
  }

  return {
    type: "type" in image && typeof image.type === "string" ? image.type : undefined,
    imageUrl,
  };
};

const generateImageWithModel = async (
  model: string,
  prompt: string,
  label: string,
): Promise<{ imageBase64: string; mimeType: string; model: string }> => {
  const completion = await openrouter.chat.send({
    chatRequest: {
      model,
      modalities: ["image"],
      messages: [{ role: "user", content: prompt }],
    },
  });

  const image = getSpecsheetImage(completion);
  if (!image) {
    const diagnostics = buildSpecsheetImageDiagnostic(completion);
    logger.warn(`${label} response had no image payload`, {
      model,
      promptLength: prompt.length,
      ...diagnostics,
    });
    throw new Error(`${label} returned no image.`);
  }

  const mimeType = image.type || "image/png";
  const imageBase64 = image.imageUrl;

  return { imageBase64, mimeType, model };
};

export const generateCharacterDescription = async (prompt: string) => {
  const completion = await openrouter.chat.send({
    chatRequest: {
      model: aiModels.characterDescription,
      messages: [
        { role: "system", content: skills.characterDescription },
        { role: "user", content: prompt },
      ],
    },
  });

  const markdown = getText(completion.choices[0]?.message?.content);

  if (!markdown) {
    throw new Error("Character description generation returned empty output.");
  }

  return {
    markdown,
    model: aiModels.characterDescription,
  };
};

export const generateCharacterDescriptionRefine = async (
  history: ChatMessage[],
  message: string,
) => {
  const completion = await openrouter.chat.send({
    chatRequest: {
      model: aiModels.characterDescription,
      messages: [
        { role: "system", content: skills.characterDescription },
        ...history,
        { role: "user", content: message },
      ],
    },
  });

  const markdown = getText(completion.choices[0]?.message?.content);
  if (!markdown) {
    throw new Error("Character description refinement returned empty output.");
  }

  return {
    markdown,
    model: aiModels.characterDescription,
  };
};

export const generateSpecsheetPrompt = async (characterDescription: string) => {
  const completion = await openrouter.chat.send({
    chatRequest: {
      model: aiModels.specsheetPrompt,
      messages: [
        { role: "system", content: skills.specsheetPrompt },
        { role: "user", content: characterDescription },
      ],
    },
  });

  const prompt = getText(completion.choices[0]?.message?.content);

  if (!prompt) {
    throw new Error("Specsheet prompt generation returned empty output.");
  }

  return {
    prompt,
    model: aiModels.specsheetPrompt,
  };
};

export const generateSpecsheetPromptRefine = async (history: ChatMessage[], message: string) => {
  const completion = await openrouter.chat.send({
    chatRequest: {
      model: aiModels.specsheetPrompt,
      messages: [
        { role: "system", content: skills.specsheetPrompt },
        ...history,
        { role: "user", content: message },
      ],
    },
  });

  const prompt = getText(completion.choices[0]?.message?.content);
  if (!prompt) {
    throw new Error("Specsheet prompt refinement returned empty output.");
  }

  return {
    prompt,
    model: aiModels.specsheetPrompt,
  };
};

export const generateSpecsheetImage = async (prompt: string) => {
  return generateImageWithModel(aiModels.specsheetImage, prompt, "Specsheet image generation");
};

export const generateSpritesheetPrompt = async (characterDescription: string) => {
  const completion = await openrouter.chat.send({
    chatRequest: {
      model: aiModels.spritesheetPrompt,
      messages: [
        { role: "system", content: skills.spritesheetPrompt },
        { role: "user", content: characterDescription },
      ],
    },
  });

  const prompt = getText(completion.choices[0]?.message?.content);
  if (!prompt) {
    throw new Error("Spritesheet prompt generation returned empty output.");
  }

  return {
    prompt,
    model: aiModels.spritesheetPrompt,
  };
};

export const generateSpritesheetImage = async (prompt: string) => {
  return generateImageWithModel(aiModels.spritesheetImage, prompt, "Spritesheet image generation");
};

export const generateAgentCode = async (characterDescription: string) => {
  const completion = await openrouter.chat.send({
    chatRequest: {
      model: aiModels.agentCode,
      messages: [
        { role: "system", content: skills.agentCode },
        { role: "user", content: characterDescription },
      ],
    },
  });

  const code = getText(completion.choices[0]?.message?.content);
  if (!code) {
    throw new Error("Agent code generation returned empty output.");
  }

  return {
    code,
    model: aiModels.agentCode,
  };
};

export const generateStrikecraftSpecsheetPrompt = async (characterDescription: string) => {
  const completion = await openrouter.chat.send({
    chatRequest: {
      model: aiModels.strikecraftSpecsheetPrompt,
      messages: [
        { role: "system", content: skills.strikecraftSpecsheetPrompt },
        { role: "user", content: characterDescription },
      ],
    },
  });

  const prompt = getText(completion.choices[0]?.message?.content);
  if (!prompt) {
    throw new Error("Strikecraft specsheet prompt generation returned empty output.");
  }

  return {
    prompt,
    model: aiModels.strikecraftSpecsheetPrompt,
  };
};

export const generateStrikecraftSpecsheetImage = async (prompt: string) => {
  return generateImageWithModel(
    aiModels.strikecraftSpecsheetImage,
    prompt,
    "Strikecraft specsheet image generation",
  );
};

export const generateStrikecraftSpritePrompt = async (strikecraftSpecsheet: string) => {
  const completion = await openrouter.chat.send({
    chatRequest: {
      model: aiModels.strikecraftSpritePrompt,
      messages: [
        { role: "system", content: skills.strikecraftSpritePrompt },
        { role: "user", content: strikecraftSpecsheet },
      ],
    },
  });

  const prompt = getText(completion.choices[0]?.message?.content);
  if (!prompt) {
    throw new Error("Strikecraft sprite prompt generation returned empty output.");
  }

  return {
    prompt,
    model: aiModels.strikecraftSpritePrompt,
  };
};

export const generateStrikecraftSpriteImage = async (prompt: string) => {
  return generateImageWithModel(
    aiModels.strikecraftSpriteImage,
    prompt,
    "Strikecraft sprite image generation",
  );
};
