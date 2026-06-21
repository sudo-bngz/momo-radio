import { useState, useEffect } from 'react';
import type { TenantConfig } from '../types';

export function useTenantConfig() {
  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const hostname = window.location.hostname;
        
        const urlParams = new URLSearchParams(window.location.search);
        const queryTenant = urlParams.get('tenant');
        
        const subdomainTenant = hostname.split('.')[0] === 'localhost' ? 'demo-tenant' : hostname.split('.')[0];
        const tenantId = queryTenant || subdomainTenant;
        
        // Pull both URLs from Vite's environment
        const cdnBaseUrl = import.meta.env.VITE_CDN_BASE_URL;
        const streamBaseUrl = import.meta.env.VITE_STREAM_BASE_URL;
        
        const res = await fetch(`${cdnBaseUrl}/${tenantId}/theme.json`);
        if (!res.ok) throw new Error('Tenant configuration not found');
        
        const data: TenantConfig = await res.json();
        
        // Dynamically construct the stream URL based on the environment
        data.tenantId = tenantId;
        data.streamUrl = `${streamBaseUrl}/${tenantId}/radio/stream.m3u8`; 
        
        setConfig(data);
      } catch (err: any) {
        setError(err.message);
      }
    };

    fetchConfig();
  }, []);

  return { config, error };
}
