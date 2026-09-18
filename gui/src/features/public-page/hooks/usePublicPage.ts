import { useState, useEffect } from 'react';
import { api, type PublicPageConfig } from '../../../services/api';

export const usePublicPage = () => {
  const [config, setConfig] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slugError, setSlugError] = useState("");

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const data = await api.getPublicPageSettings();
        setConfig(data);
      } catch (err) {
        console.error("Failed to load public page config", err);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleSlugChange = (newSlug: string) => {
    if (!config) return;
    const sanitized = newSlug
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-') // Replace invalid chars with hyphens
      .replace(/-+/g, '-');        // Prevent double hyphens

    setConfig({ ...config, slug: sanitized });
    setSlugError(""); // Clear error while typing
  };

  const updateConfig = (updates: Partial<PublicPageConfig>) => {
    if (config) setConfig({ ...config, ...updates });
  };

  const saveConfig = async () => {
    if (!config) return false;
    
    if (config.slug.length < 3) {
      setSlugError("Slug must be at least 3 characters.");
      return false;
    }

    try {
      setSaving(true);
      await api.updatePublicPageSettings(config);
      setSlugError(""); // Clear on success
      return true;
    } catch (error: any) {
      if (error.response?.status === 409) {
        setSlugError("This subdomain is already taken. Please choose another.");
      } else {
        setSlugError("Failed to save settings. Please try again.");
      }
      return false;
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (file: File, type: 'background' | 'logo') => {
    if (!config) return;
    const response = await api.uploadPublicImage(file, type);
    if (type === 'background') {
      setConfig({ ...config, background_image_url: response.url, background_image_key: response.key });
    } else {
      setConfig({ ...config, logo_url: response.url, logo_key: response.key });
    }
  };

  return {
    config,
    loading,
    saving,
    slugError,
    handleSlugChange,
    updateConfig,
    saveConfig,
    uploadImage
  };
};
