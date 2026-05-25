let accessToken: string | undefined;

export const setApiAccessToken = (token: string | undefined) => {
  accessToken = token;
};

export const authHeadersJson = (): HeadersInit => ({
  ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
});

export const readErrorText = async (response: Response) =>
  (await response.text()) || response.statusText;

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
