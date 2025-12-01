import React, { useRef, useState, useEffect } from 'react';

interface VerticalSliderProps {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  lineLength?: number;
  numLines?: number; 
}

const VerticalSlider: React.FC<VerticalSliderProps> = ({ 
  min, 
  max, 
  value, 
  onChange, 
  lineLength = 6, 
  numLines 
}) => {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartValue, setDragStartValue] = useState(value);
  const wheelSensitivity = useRef(0);

  
  const getVisibleNumbers = () => {
    const numbers: number[] = [];
    const range = 2; 
    
    for (let i = value - range; i <= value + range; i++) {
      if (i >= min && i <= max) {
        numbers.push(i);
      }
    }
    
    return numbers;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    wheelSensitivity.current += e.deltaY;
    
    if (Math.abs(wheelSensitivity.current) > 150) {
      const delta = wheelSensitivity.current > 0 ? -1 : 1;
      const newValue = Math.max(min, Math.min(max, value + delta));
      onChange(newValue);
      wheelSensitivity.current = 0; 
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!sliderRef.current) return;
    setIsDragging(true);
    setDragStartY(e.clientY);
    setDragStartValue(value);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !sliderRef.current) return;
    
    const rect = sliderRef.current.getBoundingClientRect();
    const deltaY = e.clientY - dragStartY;
    const sliderHeight = rect.height;
    const valueRange = max - min;
    
  
  
    const pixelsPerValue = sliderHeight / (valueRange * 2); 
    const valueDelta = Math.round(deltaY / pixelsPerValue);
    const newValue = Math.max(min, Math.min(max, dragStartValue - valueDelta));
    
    if (newValue !== value) {
      onChange(newValue);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStartY, dragStartValue]);

  const handleClick = (num: number) => {
    onChange(num);
  };

  const visibleNumbers = getVisibleNumbers();
  const selectedIndex = visibleNumbers.indexOf(value);

  const allMeasurementLines: number[] = [];
  const totalValues = max - min + 1;
  const totalLines = numLines || totalValues;
  
  for (let i = 0; i < totalLines; i++) {
    if (numLines) {
      const num = min + Math.round((i / (totalLines - 1)) * (max - min));
      allMeasurementLines.push(num);
    } else {
      const num = min + i;
      allMeasurementLines.push(num);
    }
  }

  return (
    <div
      ref={sliderRef}
      className="relative h-24 w-12 rounded-xl bg-[#1A1A1A] border border-[#968EF3] overflow-hidden cursor-pointer select-none"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        boxShadow: `
          inset 0 10px 15px rgba(0, 0, 0, 0.5), 
          inset 0 -2px 8px rgba(0, 0, 0, 0.3),
          inset 0 6px 12px rgba(0, 0, 0, 0.6),
          inset 0 -10px 12px rgba(0, 0, 0, 0.4)
        `,
      }}
    >
   
      <div className="absolute -left-1 top-0 bottom-0 w-full pointer-events-none" style={{ paddingTop: '4px', paddingBottom: '4px' }}>
        {allMeasurementLines.map((num, idx) => {
          const percentage = totalLines > 1 ? (idx / (totalLines - 1)) * 100 : 50; 
          
          return (
            <div
              key={`${num}-${idx}`}
              className="absolute bg-[#968EF3]"
              style={{
                left: '4px',
                top: `${percentage}%`,
                width: `${lineLength}px`, 
                height: '2px', 
                transform: 'translateY(-50%)',
                opacity: 0.4,
              }}
            />
          );
        })}
      </div>

      <div
        className="absolute left-0 w-2 h-0.5 bg-red-500 z-10 pointer-events-none"
        style={{
          top: '50%',
          transform: 'translateY(-50%)',
          boxShadow: '0 0 2px rgba(255, 0, 0, 0.5)',
        }}
      />

      <div className="relative w-full h-full flex flex-col items-center justify-center pointer-events-none" style={{ perspective: '300px' }}>
        {visibleNumbers.map((num, idx) => {
          const distance = Math.abs(idx - selectedIndex);
          const isSelected = num === value;
          const direction = idx - selectedIndex > 0 ? 1 : -1;
          const isAbove = direction < 0; 
          
          let spacing = 0;
          if (distance === 0) {
            spacing = 0; 
          } else if (distance === 1) {
            spacing = direction * 22;
          } else if (distance === 2) {
            spacing = direction * (22 + 15);
          }
          
          const tiltAngle = distance > 0 ? (isAbove ? -12 : 12) * (1 - distance * 0.3) : 0;
          
          const baseFontSize = isSelected ? 20 : Math.max(15, 15 - distance * 5);
          const fontSize = isSelected 
            ? baseFontSize 
            : isAbove 
              ? baseFontSize * 0.85 
              : baseFontSize;
          
          return (
            <button
              key={num}
              onClick={() => handleClick(num)}
              className="absolute transition-all duration-200 pointer-events-auto cursor-pointer"
              style={{
                top: `${50 + spacing}%`,
                transform: `translateY(-50%) rotateX(${tiltAngle}deg)`,
                transformStyle: 'preserve-3d',
                fontSize: `${fontSize}px`,
                fontWeight: isSelected ? 'bold' : 'normal',
                color: isSelected ? '#C9B3FF' : '#968EF3',
                opacity: isSelected ? 1 : Math.max(0.2, 1 - distance * 0.3),
                userSelect: 'none',
              }}
            >
              {num}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default VerticalSlider;
