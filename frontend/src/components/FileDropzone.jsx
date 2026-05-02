import { useCallback, useState } from "react";
import { Upload, X, File, FileText, Image as ImageIcon, AlertCircle } from "lucide-react";

const FileDropzone = ({ files, setFiles, maxFiles = 5, maxSizeMB = 10 }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState(null);

    const onDragOver = useCallback((e) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const onDragLeave = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const validateFiles = (newFiles) => {
        if (files.length + newFiles.length > maxFiles) {
            setError(`Maximum ${maxFiles} files allowed`);
            return false;
        }

        const oversized = Array.from(newFiles).some(f => f.size > maxSizeMB * 1024 * 1024);
        if (oversized) {
            setError(`Individual file size cannot exceed ${maxSizeMB}MB`);
            return false;
        }

        setError(null);
        return true;
    };

    const onDrop = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFiles = Array.from(e.dataTransfer.files);
        if (validateFiles(droppedFiles)) {
            setFiles(prev => [...prev, ...droppedFiles]);
        }
    }, [files, maxFiles, maxSizeMB, setFiles]);

    const onFileInput = (e) => {
        const selectedFiles = Array.from(e.target.files);
        if (validateFiles(selectedFiles)) {
            setFiles(prev => [...prev, ...selectedFiles]);
        }
    };

    const removeFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const getFileIcon = (type) => {
        if (type.startsWith('image/')) return <ImageIcon className="h-5 w-5 text-blue-500" />;
        if (type.includes('pdf')) return <AlertCircle className="h-5 w-5 text-red-500" />;
        return <FileText className="h-5 w-5 text-gray-500" />;
    };

    const formatSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = 2;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    return (
        <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Attachments (Optional)</label>
            
            <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={`relative border-2 border-dashed rounded-xl p-6 transition-all duration-200 flex flex-col items-center justify-center gap-2 cursor-pointer
                    ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}
                onClick={() => document.getElementById('file-input').click()}
            >
                <input
                    id="file-input"
                    type="file"
                    multiple
                    className="hidden"
                    onChange={onFileInput}
                />
                <div className="p-3 bg-indigo-50 rounded-full text-indigo-600">
                    <Upload className="h-6 w-6" />
                </div>
                <div className="text-center">
                    <p className="text-sm font-medium text-gray-900">Click or drag to upload</p>
                    <p className="text-xs text-gray-500 mt-1">PDF, Word, Excel, or Images (Max {maxSizeMB}MB)</p>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 text-red-600 text-xs font-medium bg-red-50 p-2 rounded-lg">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                </div>
            )}

            {files.length > 0 && (
                <div className="space-y-2">
                    {files.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 group">
                            <div className="flex items-center gap-3">
                                {getFileIcon(file.type)}
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{file.name}</p>
                                    <p className="text-[10px] text-gray-400 font-medium uppercase">{formatSize(file.size)}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                                className="p-1 hover:bg-gray-200 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default FileDropzone;
