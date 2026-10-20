import { useState, useMemo } from 'react';
import { Clock, ChevronDown } from 'lucide-react';
import { META_TIMEZONES, COMMON_TIMEZONES, type MetaTimezone } from '@/lib/metaTimezones';

interface Props {
  value: string;
  onChange: (iana: string) => void;
  label?: string;
  compact?: boolean;
}

export default function TimezonePicker({ value, onChange, label, compact }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected = useMemo(
    () => META_TIMEZONES.find((tz) => tz.iana === value) || null,
    [value],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return META_TIMEZONES;
    const q = search.toLowerCase();
    return META_TIMEZONES.filter(
      (tz) => tz.iana.toLowerCase().includes(q) || tz.label.toLowerCase().includes(q),
    );
  }, [search]);

  const handleSelect = (tz: MetaTimezone) => {
    onChange(tz.iana);
    setOpen(false);
    setSearch('');
  };

  const tryDetect = () => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (META_TIMEZONES.some((tz) => tz.iana === detected)) {
      onChange(detected);
    } else {
      // Fallback: try to find a close match
      const match = META_TIMEZONES.find((tz) => tz.iana.toLowerCase() === detected.toLowerCase());
      if (match) onChange(match.iana);
    }
  };

  if (compact) {
    return (
      <div className="tz-picker-compact">
        <button
          type="button"
          className="tz-picker-trigger-compact"
          onClick={() => setOpen(!open)}
        >
          <Clock size={13} />
          <span>{selected ? selected.label : 'Detect timezone'}</span>
          <ChevronDown size={12} style={{ opacity: 0.5 }} />
        </button>
        {open && (
          <div className="tz-picker-dropdown">
            <div className="tz-picker-search-wrap">
              <input
                type="text"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search timezones..."
                className="tz-picker-search"
              />
              <button className="tz-picker-detect" onClick={tryDetect} type="button">
                Auto-detect
              </button>
            </div>
            {!search && (
              <div className="tz-picker-section">
                <span className="tz-picker-section-label">Common</span>
                {COMMON_TIMEZONES.map((tz) => (
                  <button
                    key={tz.id}
                    className={`tz-picker-option ${value === tz.iana ? 'active' : ''}`}
                    onClick={() => handleSelect(tz)}
                    type="button"
                  >
                    {tz.label}
                  </button>
                ))}
              </div>
            )}
            <div className="tz-picker-section">
              {!search && <span className="tz-picker-section-label">All ({filtered.length})</span>}
              <div className="tz-picker-scroll">
                {filtered.slice(0, search ? 100 : 50).map((tz) => (
                  <button
                    key={tz.id}
                    className={`tz-picker-option ${value === tz.iana ? 'active' : ''}`}
                    onClick={() => handleSelect(tz)}
                    type="button"
                  >
                    {tz.label}
                  </button>
                ))}
                {filtered.length > (search ? 100 : 50) && (
                  <span className="tz-picker-more">Keep typing to narrow down...</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="tz-picker">
      {label && <label className="tz-picker-label">{label}</label>}
      <button
        type="button"
        className="tz-picker-trigger"
        onClick={() => setOpen(!open)}
      >
        <Clock size={15} />
        <span>{selected ? selected.label : 'Select timezone...'}</span>
        <ChevronDown size={14} style={{ opacity: 0.5, marginLeft: 'auto' }} />
      </button>
      {open && (
        <>
          <div className="tz-picker-overlay" onClick={() => setOpen(false)} />
          <div className="tz-picker-dropdown">
            <div className="tz-picker-search-wrap">
              <input
                type="text"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search timezones..."
                className="tz-picker-search"
              />
              <button className="tz-picker-detect" onClick={tryDetect} type="button">
                Auto-detect
              </button>
            </div>
            {!search && (
              <div className="tz-picker-section">
                <span className="tz-picker-section-label">Common</span>
                {COMMON_TIMEZONES.map((tz) => (
                  <button
                    key={tz.id}
                    className={`tz-picker-option ${value === tz.iana ? 'active' : ''}`}
                    onClick={() => handleSelect(tz)}
                    type="button"
                  >
                    {tz.label}
                  </button>
                ))}
              </div>
            )}
            <div className="tz-picker-section">
              {!search && <span className="tz-picker-section-label">All ({filtered.length})</span>}
              <div className="tz-picker-scroll">
                {filtered.slice(0, search ? 100 : 50).map((tz) => (
                  <button
                    key={tz.id}
                    className={`tz-picker-option ${value === tz.iana ? 'active' : ''}`}
                    onClick={() => handleSelect(tz)}
                    type="button"
                  >
                    {tz.label}
                  </button>
                ))}
                {filtered.length > (search ? 100 : 50) && (
                  <span className="tz-picker-more">Keep typing to narrow down...</span>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
