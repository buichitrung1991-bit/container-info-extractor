import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Loader2, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, ClipboardPaste, X, FileImage } from 'lucide-react';
import { extractImageInfo } from './services/geminiService';

const API_URL = "https://script.google.com/macros/s/AKfycbxUgk5YjRLAzylfxDQUqMBwtEsWpw8qz8OMQy9J5Ea2zfYqge-WbuIO5yPYDj611ubD/exec";
const COLUMNS_TO_SHOW = ["Ngày", "Book / BL", "Note", "Vol", "HẠ HÀNG", "VESSEL", "Containers No."];

export default function App() {
  const [allData, setAllData] = useState<any[]>([]);
  const [actualColumns, setActualColumns] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [extractedInfo, setExtractedInfo] = useState<{containerNo?: string, sealNo?: string, weight?: string} | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            processImage(blob);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(API_URL);
      const textData = await response.text();
      
      let data;
      try {
        data = JSON.parse(textData);
      } catch (e) {
        throw new Error("Lỗi Quyền Truy Cập: Trạm trung chuyển chưa được cấp quyền công khai.");
      }
      
      if (data.error) throw new Error("Google báo lỗi nội bộ: " + data.error);
      
      if (data.length > 0) {
        const availableHeaders = Object.keys(data[0]);
        const actualCols = COLUMNS_TO_SHOW.filter(col => availableHeaders.includes(col));
        setActualColumns(actualCols);
        
        const giaiChiCol = availableHeaders.find(col => col.trim().toLowerCase() === "giải chi");
        let filteredData = data;
        if (giaiChiCol) {
          filteredData = data.filter((row: any) => {
            return String(row[giaiChiCol]).trim().toUpperCase() === "FALSE";
          });
        }
        
        setAllData(filteredData.reverse());
      }
    } catch (err: any) {
      let errorMsg = err.message;
      if (errorMsg === "Failed to fetch") errorMsg = "Lỗi mạng hoặc bị chặn bảo mật trình duyệt.";
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const processImage = async (file: File) => {
    setImageFile(file);
    setIsExtracting(true);
    setExtractionError(null);
    setExtractedInfo(null);
    
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64data = (reader.result as string).split(',')[1];
        const mimeType = file.type;
        
        try {
          const info = await extractImageInfo(base64data, mimeType);
          if (info) {
            setExtractedInfo(info);
            if (info.containerNo) {
              setSearchQuery(info.containerNo);
              setIsExpanded(true); // Auto expand when searching
            }
          }
        } catch (apiError: any) {
          setExtractionError("Lỗi khi nhận diện hình ảnh: " + apiError.message);
        } finally {
          setIsExtracting(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setExtractionError("Không thể đọc file hình ảnh. Vui lòng thử lại.");
      setIsExtracting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processImage(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        processImage(file);
      }
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setExtractedInfo(null);
    setExtractionError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return allData;
    const lowerQuery = searchQuery.toLowerCase().trim();
    return allData.filter(row => 
      actualColumns.some(header => 
        String(row[header] || '').toLowerCase().includes(lowerQuery)
      )
    );
  }, [allData, searchQuery, actualColumns]);

  const displayedData = useMemo(() => {
    if (isExpanded || filteredData.length <= 10) return filteredData;
    return filteredData.slice(0, 10);
  }, [filteredData, isExpanded]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold text-emerald-600 tracking-tight">
            Tra Cứu Thông Tin Trực Tuyến
          </h1>
          <p className="text-slate-500">
            Dán ảnh (Ctrl+V) hoặc tải ảnh lên để tự động nhận diện thông tin
          </p>
        </div>

        {/* Image Recognition Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Upload Area */}
              <div 
                className={`relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-colors ${
                  imagePreview ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-300 hover:border-emerald-400 hover:bg-slate-50'
                }`}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => !imagePreview && fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleFileChange}
                />
                
                {imagePreview ? (
                  <div className="relative w-full h-48 flex items-center justify-center">
                    <img src={imagePreview} alt="Preview" className="max-h-full max-w-full object-contain rounded-lg shadow-sm" />
                    <button 
                      onClick={(e) => { e.stopPropagation(); clearImage(); }}
                      className="absolute -top-2 -right-2 bg-white text-slate-500 hover:text-red-500 rounded-full p-1 shadow-md border border-slate-200"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 cursor-pointer py-8">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                      <ClipboardPaste size={32} />
                    </div>
                    <div>
                      <p className="font-medium text-slate-700">Nhấn Ctrl+V để dán ảnh</p>
                      <p className="text-sm text-slate-500 mt-1">hoặc kéo thả / click để chọn file</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Extraction Results */}
              <div className="flex flex-col justify-center">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <FileImage className="text-emerald-500" size={20} />
                  Kết quả nhận diện
                </h3>
                
                {isExtracting ? (
                  <div className="flex flex-col items-center justify-center h-32 space-y-3 text-emerald-600 bg-emerald-50 rounded-xl border border-emerald-100">
                    <Loader2 className="animate-spin" size={28} />
                    <p className="font-medium animate-pulse">Đang phân tích hình ảnh...</p>
                  </div>
                ) : extractionError ? (
                  <div className="flex items-start gap-3 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100">
                    <AlertCircle className="shrink-0 mt-0.5" size={20} />
                    <p className="text-sm">{extractionError}</p>
                  </div>
                ) : extractedInfo ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Số Cont</p>
                        <p className="font-mono font-semibold text-slate-900 truncate" title={extractedInfo.containerNo || 'Không tìm thấy'}>
                          {extractedInfo.containerNo || <span className="text-slate-400 italic font-sans font-normal">Trống</span>}
                        </p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Số Seal</p>
                        <p className="font-mono font-semibold text-slate-900 truncate" title={extractedInfo.sealNo || 'Không tìm thấy'}>
                          {extractedInfo.sealNo || <span className="text-slate-400 italic font-sans font-normal">Trống</span>}
                        </p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Số Cân</p>
                        <p className="font-mono font-semibold text-slate-900 truncate" title={extractedInfo.weight || 'Không tìm thấy'}>
                          {extractedInfo.weight || <span className="text-slate-400 italic font-sans font-normal">Trống</span>}
                        </p>
                      </div>
                    </div>
                    {extractedInfo.containerNo && (
                      <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 p-2.5 rounded-lg border border-emerald-100">
                        <CheckCircle2 size={16} className="shrink-0" />
                        <p>Đã tự động điền số Cont vào ô tìm kiếm.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32 text-slate-400 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                    <p className="text-sm">Chưa có dữ liệu nhận diện</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Search Box */}
        <div className="relative max-w-2xl mx-auto space-y-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-11 pr-4 py-3.5 bg-white border-2 border-slate-200 rounded-full text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-lg shadow-sm"
              placeholder="Nhập từ khóa (Ví dụ: TCNU4970317)..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsExpanded(false);
              }}
            />
            {searchQuery && (
              <button 
                onClick={() => { setSearchQuery(''); setIsExpanded(false); }}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            )}
          </div>

          {/* Toggle Button Moved Here */}
          {!isLoading && !error && filteredData.length > 10 && (
            <div className="flex justify-center">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-full border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 transition-colors"
              >
                {isExpanded ? (
                  <>
                    Thu gọn danh sách <ChevronUp size={16} />
                  </>
                ) : (
                  <>
                    Hiển thị thêm {filteredData.length - 10} kết quả <ChevronDown size={16} />
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Status / Error */}
        {isLoading && (
          <div className="text-center py-8 text-slate-500 flex flex-col items-center gap-3">
            <Loader2 className="animate-spin text-emerald-500" size={32} />
            <p className="italic">Đang kết nối hệ thống an toàn, vui lòng đợi vài giây...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
              <div>
                <h3 className="text-red-800 font-bold mb-1">KẾT NỐI THẤT BẠI!</h3>
                <p className="text-red-700 text-sm whitespace-pre-line">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Data Table */}
        {!isLoading && !error && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-emerald-600 text-white">
                      {actualColumns.map((col, idx) => (
                        <th key={idx} className="px-4 py-3.5 font-semibold text-sm whitespace-nowrap border-b border-emerald-700">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {displayedData.length === 0 ? (
                      <tr>
                        <td colSpan={actualColumns.length} className="px-4 py-8 text-center text-slate-500 font-medium">
                          Không có dữ liệu hoặc tất cả đều đã được Giải chi!
                        </td>
                      </tr>
                    ) : (
                      displayedData.map((row, rowIdx) => (
                        <tr key={rowIdx} className="hover:bg-slate-50 transition-colors">
                          {actualColumns.map((col, colIdx) => (
                            <td key={colIdx} className="px-4 py-3 text-sm text-slate-700">
                              {row[col] || ''}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
