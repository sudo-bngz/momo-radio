import { useEffect } from 'react';
import { useSearchStore } from '../../../store/useSearchStore';
import { api } from '../../../services/api';

export const useAdvancedSearch = (
  setTracks: (tracks: any[]) => void, 
  setSearchQuery: (query: string) => void
) => {
  const globalSearch = useSearchStore((state: any) => state.globalSearch);

  useEffect(() => { 
    const executeAdvancedSearch = async (filterStr: string) => {
      try {
        const data = await api.searchTracksByFilter(filterStr);
        
        if (data && data.hits) {
          const mappedTracks = data.hits.map((hit: any) => ({
            id: typeof hit.id === 'string' ? Number(hit.id.replace('track-', '')) : Number(hit.id),
            organization_id: hit.organization_id || '',
            key: hit.id, 
            title: hit.title,
            artist: hit.artists_names?.join(', ') || 'Unknown Artist',
            album: hit.album_title || '',
            genre: hit.genre || '',
            style: hit.style || '',
            duration: hit.duration || 0,
            cover_url: hit.cover_url || '',
            bpm: hit.bpm || 0,
            musical_key: hit.musical_key || '',
            scale: hit.scale || '',
            status: 'completed',
            processing_status: 'completed'
          }));
          setTracks(mappedTracks);
        } else {
          setTracks([]);
        }
      } catch (error) {
        console.error("Filter search failed:", error);
        setTracks([]); 
      }
    };

    const timeoutId = setTimeout(() => {
      if (!globalSearch) {
        setSearchQuery('');
        return;
      }

      if (globalSearch.toLowerCase().startsWith('filter:')) {
        const rawFilter = globalSearch.substring(7).trim();
        if (rawFilter) executeAdvancedSearch(rawFilter);
        return;
      }

      const filterMap: Record<string, string> = {
        artist: 'artists_names', album: 'album_title', genre: 'genre', style: 'style',
        mood: 'mood', scale: 'scale', key: 'musical_key', bpm: 'bpm', duration: 'duration', year: 'year'
      };
      const numericFields = ['bpm', 'duration', 'year'];
      const filterKeys = Object.keys(filterMap).join('|');

      const hasFilter = new RegExp(`\\b(${filterKeys})\\s*(:|>=|<=|>|<|=|!=)`, 'i').test(globalSearch);

      if (hasFilter) {
        const normalizedSearch = globalSearch
          .replace(/\s+and\s+/gi, ' AND ')
          .replace(/\s+or\s+/gi, ' OR ');

        const tokens = normalizedSearch.split(/\s+(AND|OR)\s+/);
        
        const parsedTokens = tokens.map((token: string) => {
          if (token === 'AND' || token === 'OR') return token;
          
          const clauseMatch = token.match(new RegExp(`^\\s*(${filterKeys})\\s*(:|>=|<=|>|<|=|!=)\\s*(.+)$`, 'i'));
          
          if (clauseMatch) {
             const field = clauseMatch[1].toLowerCase();
             const operator = clauseMatch[2] === ':' ? '=' : clauseMatch[2];
             let val = clauseMatch[3].trim().replace(/^["'](.*)["']$/, '$1');

             const meiliField = filterMap[field];
             const formattedVal = numericFields.includes(meiliField) ? val : `"${val.replace(/"/g, '\\"')}"`;
             
             return `${meiliField} ${operator} ${formattedVal}`;
          }
          
          return token; 
        });

        const meiliFilter = parsedTokens.join(' ');
        executeAdvancedSearch(meiliFilter);
        return;
      }

      setSearchQuery(globalSearch); 
    }, 300); 

    return () => clearTimeout(timeoutId);
  }, [globalSearch, setSearchQuery, setTracks]);
};
