/** Bilddaten für die Verwaltung im Browser (Auszug aus property_images). */
export interface ManagedImage {
  id: string;
  display_path: string | null;
  base_path: string | null;
  external_url: string | null;
  width: number | null;
  height: number | null;
  sort_order: number;
  is_cover: boolean;
  caption: string | null;
  is_floor_plan: boolean;
  is_enhanced: boolean;
  is_ai_visualization: boolean;
  status: string;
}

export function isCropped(image: Pick<ManagedImage, "id" | "display_path">): boolean {
  return Boolean(image.display_path?.includes(`/${image.id}/crop-`));
}
