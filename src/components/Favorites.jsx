import { createContext, useContext, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage.js';

export const FavContext = createContext({ favs: [], toggle: () => {}, isFav: () => false, recent: [], addRecent: () => {} });
export function useFavs() { return useContext(FavContext); }

function FavProvider({ children }) {
  const [favs, setFavs] = useLocalStorage('favorites', []);
  const [recent, setRecent] = useLocalStorage('recent', []);
  const toggle = useCallback(id => {
    setFavs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, [setFavs]);
  const isFav = useCallback(id => favs.includes(id), [favs]);
  const addRecent = useCallback(id => {
    setRecent(prev => {
      const next = [id, ...prev.filter(x => x !== id)].slice(0, 8);
      return next;
    });
  }, [setRecent]);
  return (
    <FavContext.Provider value={{ favs, toggle, isFav, recent, addRecent }}>
      {children}
    </FavContext.Provider>
  );
}

export default FavProvider;
