export const removeProtocol = (url: string): string => {
  const splittedUrl = url.split("://");
  if (splittedUrl.length == 2) {
    return splittedUrl[1];
  }
  return url;
};
