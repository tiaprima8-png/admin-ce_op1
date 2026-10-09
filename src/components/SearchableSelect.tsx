import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export interface SearchableSelectProps<T> {
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  value: string;
  onChange: (value: string, item?: T) => void;
  options: T[];
  getOptionLabel: (item: T) => string;
  getOptionValue: (item: T) => string;
  filterOption?: (item: T, search: string) => boolean;
  renderOption?: (item: T, isSelected: boolean) => React.ReactNode;
  renderSelected?: (item: T | undefined) => React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function SearchableSelect<T>({
  label,
  placeholder = 'Pilih salah satu...',
  searchPlaceholder = 'Cari...',
  value,
  onChange,
  options,
  getOptionLabel,
  getOptionValue,
  filterOption,
  renderOption,
  renderSelected,
  required = false,
  disabled = false,
  className = ''
}: SearchableSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    } else if (!isOpen) {
      setSearch('');
    }
  }, [isOpen]);

  const selectedItem = options.find(o => getOptionValue(o) === value);

  const filteredOptions = options.filter(item => {
    if (!search.trim()) return true;
    if (filterOption) return filterOption(item, search.trim().toLowerCase());
    return getOptionLabel(item).toLowerCase().includes(search.trim().toLowerCase());
  });

  const handleSelect = (item: T) => {
    onChange(getOptionValue(item), item);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full text-left text-xs rounded-lg border p-2.5 flex items-center justify-between transition-colors bg-white cursor-pointer ${
          isOpen
            ? 'border-emerald-500 ring-2 ring-emerald-500/20'
            : 'border-slate-300 hover:border-slate-400'
        } ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''}`}
      >
        <div className="truncate flex-1 pr-2">
          {selectedItem ? (
            renderSelected ? (
              renderSelected(selectedItem)
            ) : (
              <span className="text-slate-900 font-medium">{getOptionLabel(selectedItem)}</span>
            )
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-emerald-600' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
          {/* Search Bar inside Popover */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/70">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full text-xs pl-8 pr-7 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500 placeholder-slate-400"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-50 p-1">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                Tidak ada data yang cocok dengan "{search}"
              </div>
            ) : (
              filteredOptions.map((item, idx) => {
                const itemVal = getOptionValue(item);
                const isSelected = itemVal === value;

                return (
                  <button
                    key={`${itemVal}-${idx}`}
                    type="button"
                    onClick={() => handleSelect(item)}
                    className={`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 text-emerald-900 font-semibold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex-1 truncate pr-2">
                      {renderOption ? renderOption(item, isSelected) : (
                        <span>{getOptionLabel(item)}</span>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
