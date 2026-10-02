export const WHATSAPP_NUMBER = "5562984856191";
export const WHATSAPP_NUMBER_FORMATTED = "(62) 98485-6191";
export const INSTAGRAM_URL = "https://instagram.com/3d.create_";

export function whatsappLink(message: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
