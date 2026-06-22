let accessToken: string | undefined;

export const setApiAccessToken = (token: string | undefined) => {
  accessToken = token;
};

export const authHeadersJson = (): HeadersInit => ({
  ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
});

export const readErrorText = async (response: Response): Promise<string> => {
  const raw = await response.text();
  if (!raw) {
    return response.statusText;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && "message" in parsed) {
      const { message } = parsed as { message: unknown };
      if (typeof message === "string" && message.length > 0) {
        return message;
      }
    }
  } catch {
    // not JSON — use the raw text
  }

  return raw;
};

export const post = async <TResponse>(
  url: string,
  body: Record<string, unknown>,
): Promise<TResponse> => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeadersJson(),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readErrorText(response));
  }

  return (await response.json()) as TResponse;
};

export const get = async <TResponse>(url: string): Promise<TResponse> => {
  const response = await fetch(url, {
    method: "GET",
    headers: authHeadersJson(),
  });

  if (!response.ok) {
    throw new Error(await readErrorText(response));
  }

  return (await response.json()) as TResponse;
};
