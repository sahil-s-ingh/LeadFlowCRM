import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X,
  Table, Phone, Loader2, RefreshCw, ChevronRight,
} from 'lucide-react';

export type UploadedContact = {
  phone_number: string;
  name?: string;
  variables: Record<string, string>;
};

export type ColumnMapping = {
  phoneColumn: string | null;
  nameColumn: string | null;
  variableColumns: Record<string, string>;
};

type Props = {
  onContactsParsed: (contacts: UploadedContact[], fileName: string) => void;
  templateVarCount: number;
};

const PHONE_HEADER_KEYWORDS = ['phone', 'mobile', 'number', 'whatsapp', 'contact', 'tel', 'cell'];
const NAME_HEADER_KEYWORDS = ['name', 'customer', 'client', 'full', 'first', 'last'];

function normalizePhone(raw: string): string {
  return String(raw).replace(/[^\d]/g, '').replace(/^00/, '');
}

function fuzzyMatchHeader(header: string, keywords: string[]): boolean {
  const lower = header.toLowerCase().trim();
  return keywords.some((kw) => lower.includes(kw));
}

function autoDetectColumns(headers: string[], templateVarCount: number): ColumnMapping {
  let phoneColumn: string | null = null;
  let nameColumn: string | null = null;

  for (const h of headers) {
    if (!phoneColumn && fuzzyMatchHeader(h, PHONE_HEADER_KEYWORDS)) phoneColumn = h;
    if (!nameColumn && fuzzyMatchHeader(h, NAME_HEADER_KEYWORDS)) nameColumn = h;
  }

  if (!phoneColumn && headers.length > 0) phoneColumn = headers[0];
  if (!nameColumn && headers.length > 1) {
    const candidate = headers.find((h) => h !== phoneColumn && fuzzyMatchHeader(h, NAME_HEADER_KEYWORDS));
    nameColumn = candidate || null;
  }

  const variableColumns: Record<string, string> = {};
  for (let i = 1; i <= templateVarCount; i++) {
    const match = headers.find((h) => {
      if (h === phoneColumn || h === nameColumn) return false;
      const lower = h.toLowerCase();
      if (i === 1 && (lower.includes('name') || lower.includes('customer') || lower.includes('full'))) return true;
      if (i === 2 && (lower.includes('email') || lower.includes('mail'))) return true;
      if (i === 3 && (lower.includes('state') || lower.includes('city') || lower.includes('location'))) return true;
      if (i === 4 && (lower.includes('product') || lower.includes('service') || lower.includes('item'))) return true;
      return false;
    });
    if (match) variableColumns[String(i)] = match;
  }

  return { phoneColumn, nameColumn, variableColumns };
}

export default function ExcelUploadPanel({ onContactsParsed, templateVarCount }: Props) {
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({ phoneColumn: null, nameColumn: null, variableColumns: {} });
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [duplicatesCount, setDuplicatesCount] = useState(0);
  const [invalidCount, setInvalidCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    setParsing(true);
    setError('');
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      if (json.length === 0) {
        setError('The file appears to be empty or has no data rows.');
        setParsing(false);
        return;
      }
      const detectedHeaders = Object.keys(json[0]);
      setHeaders(detectedHeaders);
      setRows(json);
      const autoMapping = autoDetectColumns(detectedHeaders, templateVarCount);
      setMapping(autoMapping);
      setShowPreview(true);
      computeStats(json, autoMapping);
    } catch (e) {
      setError('Could not read this file. Make sure it is a valid .xlsx, .xls, or .csv file.');
    }
    setParsing(false);
  }, [templateVarCount]);

  const computeStats = (data: Record<string, unknown>[], map: ColumnMapping) => {
    if (!map.phoneColumn) { setInvalidCount(0); setDuplicatesCount(0); return; }
    const phones: string[] = [];
    let invalid = 0;
    for (const row of data) {
      const raw = String(row[map.phoneColumn] || '').trim();
      const normalized = normalizePhone(raw);
      if (!normalized || normalized.length < 7) { invalid++; continue; }
      phones.push(normalized);
    }
    const unique = new Set(phones);
    setInvalidCount(invalid);
    setDuplicatesCount(phones.length - unique.size);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleMappingChange = (field: 'phoneColumn' | 'nameColumn', value: string) => {
    const newMapping = { ...mapping, [field]: value || null };
    setMapping(newMapping);
    computeStats(rows, newMapping);
  };

  const handleVarMappingChange = (varNum: string, value: string) => {
    const newMapping = { ...mapping, variableColumns: { ...mapping.variableColumns, [varNum]: value || '' } };
    setMapping(newMapping);
  };

  const handleConfirm = () => {
    if (!mapping.phoneColumn) { setError('Please select which column contains the phone numbers.'); return; }
    const contacts: UploadedContact[] = [];
    const seenPhones = new Set<string>();
    for (const row of rows) {
      const raw = String(row[mapping.phoneColumn] || '').trim();
      const normalized = normalizePhone(raw);
      if (!normalized || normalized.length < 7) continue;
      if (seenPhones.has(normalized)) continue;
      seenPhones.add(normalized);
      const name = mapping.nameColumn ? String(row[mapping.nameColumn] || '').trim() || undefined : undefined;
      const variables: Record<string, string> = {};
      for (const [varNum, col] of Object.entries(mapping.variableColumns)) {
        if (col) variables[varNum] = String(row[col] || '').trim();
      }
      contacts.push({ phone_number: normalized, name, variables });
    }
    if (contacts.length === 0) { setError('No valid phone numbers found with the current column mapping.'); return; }
    onContactsParsed(contacts, fileName);
  };

  const handleReset = () => {
    setFileName(''); setHeaders([]); setRows([]); setMapping({ phoneColumn: null, nameColumn: null, variableColumns: {} });
    setError(''); setShowPreview(false); setDuplicatesCount(0); setInvalidCount(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validCount = rows.length - invalidCount - duplicatesCount;
  const templateVars = Array.from({ length: templateVarCount }, (_, i) => i + 1);

  return (
    <div className="wb-excel-upload-panel">
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} style={{ display: 'none' }} />

      {!showPreview ? (
        <div
          className={`wb-dropzone ${dragOver ? 'wb-dropzone-active' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <div className="wb-dropzone-icon">
            {parsing ? <Loader2 size={36} className="crm-spin" /> : <FileSpreadsheet size={36} />}
          </div>
          <div className="wb-dropzone-text">
            <strong>{parsing ? 'Reading file...' : 'Drop your Excel or CSV file here'}</strong>
            <span>Click to browse, or drag and drop</span>
            <span className="wb-dropzone-formats">Supports .xlsx, .xls, .csv</span>
          </div>
        </div>
      ) : (
        <div className="wb-excel-config">
          <div className="wb-excel-file-info">
            <div className="wb-excel-file-left">
              <FileSpreadsheet size={18} style={{ color: '#16a34a' }} />
              <span className="wb-excel-filename">{fileName}</span>
              <span className="wb-excel-rowcount">{rows.length} rows</span>
            </div>
            <button className="wb-excel-reset" onClick={handleReset} title="Upload a different file">
              <RefreshCw size={14} /> Change File
            </button>
          </div>

          {/* Validation summary */}
          <div className="wb-excel-stats">
            <div className="wb-excel-stat wb-excel-stat-valid">
              <CheckCircle2 size={16} />
              <span><strong>{validCount}</strong> valid</span>
            </div>
            {duplicatesCount > 0 && (
              <div className="wb-excel-stat wb-excel-stat-dup">
                <AlertTriangle size={16} />
                <span><strong>{duplicatesCount}</strong> duplicate{duplicatesCount !== 1 ? 's' : ''} removed</span>
              </div>
            )}
            {invalidCount > 0 && (
              <div className="wb-excel-stat wb-excel-stat-invalid">
                <X size={16} />
                <span><strong>{invalidCount}</strong> invalid</span>
              </div>
            )}
          </div>

          {/* Column mapping */}
          <div className="wb-excel-mapping">
            <div className="wb-excel-mapping-title"><Table size={14} /><span>Column Mapping</span></div>
            <small className="wb-field-hint">We auto-detected columns. Review and adjust if needed.</small>

            <div className="wb-excel-mapping-row">
              <label className="wb-excel-mapping-label">
                <Phone size={14} style={{ color: '#25D366' }} /> Phone Number
              </label>
              <ChevronRight size={14} style={{ color: '#94a3b8' }} />
              <select value={mapping.phoneColumn || ''} onChange={(e) => handleMappingChange('phoneColumn', e.target.value)} className="wb-select">
                <option value="">-- Select column --</option>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div className="wb-excel-mapping-row">
              <label className="wb-excel-mapping-label">
                <Table size={14} style={{ color: '#94a3b8' }} /> Name (optional)
              </label>
              <ChevronRight size={14} style={{ color: '#94a3b8' }} />
              <select value={mapping.nameColumn || ''} onChange={(e) => handleMappingChange('nameColumn', e.target.value)} className="wb-select">
                <option value="">-- None --</option>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            {templateVars.length > 0 && (
              <div className="wb-excel-var-mapping">
                <div className="wb-excel-var-mapping-title"><Table size={14} /><span>Template Variable Mapping</span></div>
                <small className="wb-field-hint">Map columns from your file to template placeholders. Each recipient gets a personalized message.</small>
                {templateVars.map((v) => (
                  <div key={v} className="wb-excel-mapping-row">
                    <label className="wb-excel-mapping-label">{'{{' + v + '}}'}</label>
                    <ChevronRight size={14} style={{ color: '#94a3b8' }} />
                    <select value={mapping.variableColumns[String(v)] || ''} onChange={(e) => handleVarMappingChange(String(v), e.target.value)} className="wb-select">
                      <option value="">-- Not mapped --</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Preview table */}
          <div className="wb-excel-preview">
            <div className="wb-excel-preview-header">
              <span>Preview (first 10 rows)</span>
              <button className="wb-excel-preview-toggle" onClick={() => setShowPreview(!showPreview)}>
                {showPreview ? 'Hide' : 'Show'}
              </button>
            </div>
            {showPreview && (
              <div className="wb-table-wrap">
                <table className="wb-table">
                  <thead>
                    <tr>
                      {headers.slice(0, 8).map((h) => (
                        <th key={h} className={h === mapping.phoneColumn ? 'wb-excel-th-phone' : ''}>
                          {h}
                          {h === mapping.phoneColumn && <span className="wb-excel-th-badge">phone</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 10).map((row, i) => (
                      <tr key={i}>
                        {headers.slice(0, 8).map((h) => (
                          <td key={h} className={h === mapping.phoneColumn ? 'wb-td-phone' : ''}>
                            {String(row[h] ?? '').slice(0, 40)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {error && <div className="wb-error-banner wb-error-sm"><AlertTriangle size={14} /> {error}</div>}

          <button className="wb-create-btn wb-excel-confirm-btn" onClick={handleConfirm}>
            <CheckCircle2 size={16} /> Confirm {validCount} Recipients
          </button>
        </div>
      )}
    </div>
  );
}
