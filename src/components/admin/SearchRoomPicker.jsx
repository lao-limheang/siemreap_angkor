import { useState, useMemo, useRef, useEffect } from 'react';

/**
 * SearchRoomPicker
 * A modern, searchable room selector replacing legacy dropdowns.
 * Supports:
 * - Single room selection or Multi-room selection (1 customer can book many rooms)
 * - Instant search by room number/name, floor, bed category, or price
 * - Clear visual badges with floor, price, status
 * - Selected room chips with quick remove
 */
export default function SearchRoomPicker({
  rooms = [],
  selectedRoomId = '',
  selectedRoomIds = [],
  onSelect,
  onSelectMultiple,
  multiple = false,
  vacantOnly = false,
  placeholder = 'Search room (e.g. 101, Floor 2, Suite)...',
  label = '',
  required = false,
  className = '',
  compact = false
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [showAllStatus, setShowAllStatus] = useState(!vacantOnly);
  const containerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Normalize selected IDs
  const activeIds = useMemo(() => {
    if (multiple) {
      if (Array.isArray(selectedRoomIds) && selectedRoomIds.length > 0) {
        return selectedRoomIds.map(String);
      }
      return selectedRoomId ? [String(selectedRoomId)] : [];
    }
    return selectedRoomId ? [String(selectedRoomId)] : [];
  }, [multiple, selectedRoomId, selectedRoomIds]);

  // Selected room objects (matches by id or name)
  const selectedRooms = useMemo(() => {
    return (rooms || []).filter(r => activeIds.includes(String(r.id)) || activeIds.includes(String(r.name)));
  }, [rooms, activeIds]);

  // Filtered rooms based on search query and status filter
  const filteredRooms = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return (rooms || []).filter(r => {
      // Status filter
      if (vacantOnly && !showAllStatus) {
        const isSelected = activeIds.includes(String(r.id));
        if (!isSelected && r.status && r.status !== 'vacant') {
          return false;
        }
      }

      if (!q) return true;

      const rName = String(r.name || '').toLowerCase();
      const rNum = rName.replace(/[^0-9]/g, '');
      const rFloor = String(r.floor || '').toLowerCase();
      const rCat = String(r.categoryName || r.type || '').toLowerCase();
      const rPrice = String(r.price || r.rate || '');
      const rStatus = String(r.status || '').toLowerCase();

      return (
        rName.includes(q) ||
        rNum.includes(q) ||
        `room ${rName}`.includes(q) ||
        `floor ${rFloor}`.includes(q) ||
        rFloor === q ||
        rCat.includes(q) ||
        rPrice.includes(q) ||
        rStatus.includes(q)
      );
    });
  }, [rooms, searchQuery, vacantOnly, showAllStatus, activeIds]);

  // Handle single selection
  const handleSelectSingle = (room) => {
    if (onSelect) {
      onSelect(String(room.id), room);
    }
    if (onSelectMultiple) {
      onSelectMultiple([String(room.id)], [room]);
    }
    setIsOpen(false);
    setSearchQuery('');
  };

  // Handle multi selection toggle
  const handleToggleMulti = (room) => {
    const strId = String(room.id);
    let newIds;
    if (activeIds.includes(strId)) {
      newIds = activeIds.filter(id => id !== strId);
    } else {
      newIds = [...activeIds, strId];
    }
    const newRooms = (rooms || []).filter(r => newIds.includes(String(r.id)));
    if (onSelectMultiple) {
      onSelectMultiple(newIds, newRooms);
    }
    if (onSelect) {
      onSelect(newIds[0] || '', newRooms[0] || null);
    }
  };

  const handleRemoveRoom = (roomId, e) => {
    e?.stopPropagation();
    const strId = String(roomId);
    const newIds = activeIds.filter(id => id !== strId);
    const newRooms = (rooms || []).filter(r => newIds.includes(String(r.id)));
    if (onSelectMultiple) {
      onSelectMultiple(newIds, newRooms);
    }
    if (onSelect) {
      onSelect(newIds[0] || '', newRooms[0] || null);
    }
  };

  const handleClearAll = (e) => {
    e?.stopPropagation();
    if (onSelectMultiple) onSelectMultiple([], []);
    if (onSelect) onSelect('', null);
    setSearchQuery('');
  };

  // Status badge helper
  const getStatusBadge = (status) => {
    switch (status) {
      case 'occupied':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">Occupied</span>;
      case 'cleaning':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">Cleaning</span>;
      case 'maintenance':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">Maint.</span>;
      case 'vacant':
      default:
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Vacant</span>;
    }
  };

  // Total daily cost of selected rooms
  const totalNightlyRate = useMemo(() => {
    return selectedRooms.reduce((sum, r) => sum + (Number(r.price || r.rate || 25)), 0);
  }, [selectedRooms]);

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
          {multiple && selectedRooms.length > 0 && (
            <span className="text-[11px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
              {selectedRooms.length} room{selectedRooms.length > 1 ? 's' : ''} selected (${totalNightlyRate}/night)
            </span>
          )}
        </div>
      )}

      {/* Selected rooms display chips (Multi-mode or Single selected) */}
      {selectedRooms.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2 p-2 bg-stone-100/80 rounded-xl border border-stone-200">
          {selectedRooms.map(r => (
            <div
              key={r.id}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-brand-300 rounded-lg text-xs font-bold text-stone-900 shadow-2xs group"
            >
              <i className="fa-solid fa-door-closed text-brand-500 text-[11px]"></i>
              <span>Room {r.name}</span>
              <span className="text-[10px] font-normal text-stone-500">
                (Fl. {r.floor || '1'} · ${r.price || r.rate || 25})
              </span>
              <button
                type="button"
                onClick={(e) => handleRemoveRoom(r.id, e)}
                className="w-4 h-4 rounded-full hover:bg-red-50 hover:text-red-600 flex items-center justify-center text-stone-400 ml-0.5 transition cursor-pointer"
                title="Remove room"
              >
                <i className="fa-solid fa-xmark text-[10px]"></i>
              </button>
            </div>
          ))}

          {selectedRooms.length > 1 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-[11px] font-bold text-stone-500 hover:text-red-600 px-2 py-0.5 rounded transition cursor-pointer ml-auto"
            >
              Clear All
            </button>
          )}
        </div>
      )}

      {/* Search Input Bar */}
      <div className="relative flex items-center">
        <div className="absolute left-3 text-stone-400 pointer-events-none text-xs">
          <i className="fa-solid fa-magnifying-glass"></i>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={
            selectedRooms.length > 0 && !multiple
              ? `Selected: Room ${selectedRooms[0].name} (Click or type to change...)`
              : placeholder
          }
          className={`w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-20 py-2.5 text-xs text-stone-900 placeholder-stone-400 outline-none focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 transition shadow-2xs ${
            compact ? 'py-1.5 text-xs' : ''
          }`}
        />
        <div className="absolute right-2 flex items-center gap-1">
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="w-5 h-5 rounded-full hover:bg-stone-200 text-stone-400 hover:text-stone-700 flex items-center justify-center text-[10px]"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="px-2 py-1 bg-stone-100 hover:bg-stone-200 rounded-lg text-stone-600 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
          >
            <span>{isOpen ? 'Close' : 'Browse'}</span>
            <i className={`fa-solid fa-chevron-${isOpen ? 'up' : 'down'} text-[9px]`}></i>
          </button>
        </div>
      </div>

      {/* Search Results / Room List Dropdown Panel */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-stone-200 rounded-2xl shadow-xl overflow-hidden max-h-72 flex flex-col animate-fade-in">
          {/* Header with status counts & filters */}
          <div className="p-2.5 bg-stone-50 border-b border-stone-100 flex items-center justify-between text-xs text-stone-500">
            <div className="flex items-center gap-1.5 font-semibold">
              <i className="fa-solid fa-list-check text-brand-500"></i>
              <span>{filteredRooms.length} room{filteredRooms.length !== 1 ? 's' : ''} available</span>
            </div>
            {vacantOnly && (
              <button
                type="button"
                onClick={() => setShowAllStatus(!showAllStatus)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition cursor-pointer ${
                  showAllStatus
                    ? 'bg-brand-500 text-white border-brand-500'
                    : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                }`}
              >
                {showAllStatus ? 'Showing All Rooms' : 'Vacant Rooms Only'}
              </button>
            )}
          </div>

          {/* List of rooms */}
          <div className="overflow-y-auto divide-y divide-stone-100">
            {filteredRooms.length === 0 ? (
              <div className="p-6 text-center text-xs text-stone-400">
                <i className="fa-solid fa-door-open text-2xl text-stone-300 mb-1.5 block"></i>
                No matching rooms found for &quot;{searchQuery}&quot;
              </div>
            ) : (
              filteredRooms.map(r => {
                const isSelected = activeIds.includes(String(r.id)) || activeIds.includes(String(r.name));
                return (
                  <div
                    key={r.id}
                    onClick={() => {
                      if (multiple) {
                        handleToggleMulti(r);
                      } else {
                        handleSelectSingle(r);
                      }
                    }}
                    className={`p-2.5 px-3.5 flex items-center justify-between gap-3 cursor-pointer transition select-none ${
                      isSelected
                        ? 'bg-brand-50/80 hover:bg-brand-100/70 border-l-4 border-brand-500'
                        : 'hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {multiple ? (
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition ${
                            isSelected
                              ? 'bg-brand-500 border-brand-500 text-white'
                              : 'border-stone-300 bg-white'
                          }`}
                        >
                          {isSelected && <i className="fa-solid fa-check text-[9px]"></i>}
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-lg bg-stone-100 text-stone-600 flex items-center justify-center text-xs font-black shrink-0">
                          {r.name}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-stone-900 text-xs truncate">
                            Room {r.name}
                          </span>
                          <span className="text-[10px] text-stone-500 font-medium">
                            Floor {r.floor || '1'}
                          </span>
                          {getStatusBadge(r.status)}
                        </div>
                        <div className="text-[11px] text-stone-500 truncate">
                          {r.categoryName || `${r.bedCount || 1} Bed`}
                          {r.bedType ? ` • ${r.bedType}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-black text-brand-600">
                        ${r.price || r.rate || 25}
                        <span className="text-[10px] font-normal text-stone-400">/night</span>
                      </div>
                      {multiple && (
                        <span className="text-[10px] text-stone-400">
                          {isSelected ? 'Click to remove' : 'Click to add'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer note for multiple */}
          {multiple && (
            <div className="p-2 bg-stone-50 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500">
              <span>Tip: You can select multiple rooms for 1 customer</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1 bg-brand-500 text-white rounded-lg font-bold text-xs hover:bg-brand-600 transition cursor-pointer"
              >
                Done ({selectedRooms.length})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
