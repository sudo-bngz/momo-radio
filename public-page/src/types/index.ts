export interface TenantConfig {
  tenantId: string;
  streamUrl: string;       
  visual_mode?: 'hydra' | 'image' | 'preset';
  hydra_code?: string;
  background_image_url?: string;
  accent_color?: string;
  theme_mode?: string;
  logo_url?: string;
  bio?: string;
  custom_css?: string;
}