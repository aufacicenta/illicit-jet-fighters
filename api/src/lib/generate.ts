import { aiModels } from "./ai-models";
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
  image_url: { url: string };
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
  if (
    !image ||
    typeof image !== "object" ||
    !("image_url" in image) ||
    typeof image.image_url !== "object" ||
    image.image_url === null ||
    !("url" in image.image_url) ||
    typeof image.image_url.url !== "string"
  ) {
    return undefined;
  }

  return {
    type: "type" in image && typeof image.type === "string" ? image.type : undefined,
    image_url: { url: image.image_url.url },
  };
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
  const completion = await openrouter.chat.send({
    chatRequest: {
      model: aiModels.specsheetImage,
      modalities: ["image"],
      messages: [{ role: "user", content: prompt }],
    },
  });

  const image = getSpecsheetImage(completion);
  if (!image) {
    throw new Error("Specsheet image generation returned no image.");
  }

  const mimeType = image.type || "image/png";
  const imageBase64 = image.image_url.url;

  return {
    imageBase64,
    mimeType,
    model: aiModels.specsheetImage,
  };
};
