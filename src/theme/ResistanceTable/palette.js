import React, {createContext, useContext, useMemo} from 'react';

export const createPalette = (colorMode) => {
  if (colorMode === 'dark') {
    return {
      border: '#444',
      background: '#1e1e1e',
      text: '#eee',
      subtleBg: '#252525',
      subtleBgHover: '#333',
      sourceInfoBg: '#333',
      sourceInfoText: '#bbb',
      emptyCellBg: '#2a2a2a',
      tooltipBg: 'rgba(200, 200, 200, 0.9)',
      tooltipText: '#000',
      overlay: 'rgba(30, 30, 30, 0.7)',
      primary: 'var(--ifm-color-primary, #7aa2f7)'
    };
  }
  return {
    border: '#ddd',
    background: '#fff',
    text: '#333',
    subtleBg: '#f9f9f9',
    subtleBgHover: '#f0f0f0',
    sourceInfoBg: '#f0f0f0',
    sourceInfoText: '#666',
    emptyCellBg: '#f2f2f2',
    tooltipBg: 'rgba(60, 60, 60, 0.9)',
    tooltipText: '#fff',
    overlay: 'rgba(255, 255, 255, 0.7)',
    primary: 'var(--ifm-color-primary, #3578e5)'
  };
};

const PaletteContext = createContext(createPalette('light'));

export const PaletteProvider = ({colorMode, children}) => {
  const value = useMemo(() => createPalette(colorMode), [colorMode]);
  return <PaletteContext.Provider value={value}>{children}</PaletteContext.Provider>;
};

export const usePalette = () => useContext(PaletteContext);

