export type SpecsheetImageRequest = {
  prompt: string;
};

export type SpecsheetImageResponse = {
  imageBase64: string;
  mimeType: string;
  model: string;
};
