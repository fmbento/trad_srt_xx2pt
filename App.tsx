import React, { useState, useCallback, useRef } from 'react';
import type { SubtitleBlock } from './types';
import { translateTexts } from './services/geminiService';
import Icon from './components/Icon';

// Heuristic for chunking: ~1000 tokens is roughly 3750 characters.
// We use a smaller, safer value to stay well within API limits and prevent network errors.
const CHARACTER_LIMIT_PER_CHUNK = 3750;

const App: React.FC = () => {
    const [inputFile, setInputFile] = useState<File | null>(null);
    const [isTranslating, setIsTranslating] = useState<boolean>(false);
    const [translationProgress, setTranslationProgress] = useState<string>('');
    const [translationProgressPercent, setTranslationProgressPercent] = useState<number>(0);
    const [translatedContent, setTranslatedContent] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const resetState = () => {
        setInputFile(null);
        setIsTranslating(false);
        setTranslationProgress('');
        setTranslationProgressPercent(0);
        setTranslatedContent(null);
        setError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleFileSelect = (files: FileList | null) => {
        if (files && files.length > 0) {
            const file = files[0];
            if (file.name.toLowerCase().endsWith('.srt')) {
                resetState();
                setInputFile(file);
            } else {
                setError('Tipo de ficheiro inválido. Por favor, selecione um ficheiro .srt.');
            }
        }
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        handleFileSelect(e.dataTransfer.files);
    };

    const parseSrt = (srtContent: string): SubtitleBlock[] => {
        const blocks = srtContent.trim().replace(/\r\n/g, '\n').split('\n\n');
        return blocks.map(block => {
            const lines = block.split('\n');
            if (lines.length < 2) return null; // malformed block
            const index = lines[0];
            const time = lines[1];
            const text = lines.slice(2).join('\n');
            // Basic validation for SRT format
            if (!/^\d+$/.test(index) || !time.includes('-->')) return null;
            return { index, time, text };
        }).filter((b): b is SubtitleBlock => b !== null && b.text.trim() !== '');
    };

    const stringifySrt = (subtitles: SubtitleBlock[]): string => {
        return subtitles.map(sub => `${sub.index}\n${sub.time}\n${sub.text}`).join('\n\n') + '\n\n';
    };

    const chunkSubtitles = (subtitles: SubtitleBlock[]): SubtitleBlock[][] => {
        const chunks: SubtitleBlock[][] = [];
        let currentChunk: SubtitleBlock[] = [];
        let currentChunkCharCount = 0;

        for (const subtitle of subtitles) {
            const subtitleCharCount = subtitle.text.length;
            if (currentChunk.length > 0 && currentChunkCharCount + subtitleCharCount > CHARACTER_LIMIT_PER_CHUNK) {
                chunks.push(currentChunk);
                currentChunk = [];
                currentChunkCharCount = 0;
            }
            currentChunk.push(subtitle);
            currentChunkCharCount += subtitleCharCount;
        }

        if (currentChunk.length > 0) {
            chunks.push(currentChunk);
        }

        return chunks;
    };
    
    const getOutputFilename = (originalName: string): string => {
        const parts = originalName.split('.');
        if (parts.length > 1 && parts[parts.length - 1].toLowerCase() === 'srt') {
            parts.splice(parts.length - 1, 0, 'pt');
            return parts.join('.');
        }
        return `${originalName}.pt.srt`;
    }

    const handleTranslate = useCallback(async () => {
        if (!inputFile) return;

        setIsTranslating(true);
        setError(null);
        setTranslationProgress('A ler o ficheiro...');
        setTranslationProgressPercent(0);

        try {
            await new Promise(resolve => setTimeout(resolve, 200)); // Short delay for UI update
            const content = await inputFile.text();
            setTranslationProgress('A analisar o conteúdo SRT...');
            setTranslationProgressPercent(5);
            const subtitles = parseSrt(content);
            if (subtitles.length === 0) {
              throw new Error("Não foi possível encontrar blocos de legendas válidos no ficheiro. Por favor, verifique o formato do ficheiro.");
            }

            const chunks = chunkSubtitles(subtitles);
            const translatedSubtitles: SubtitleBlock[] = [];

            for (let i = 0; i < chunks.length; i++) {
                const progress = Math.round(((i + 1) / chunks.length) * 90) + 5; // Scale progress from 5% to 95%
                setTranslationProgress(`A traduzir bloco ${i + 1} de ${chunks.length}...`);
                setTranslationProgressPercent(progress);
                
                const chunkToTranslate = chunks[i];
                const textsToTranslate = chunkToTranslate.map(sub => sub.text);
                const translatedTexts = await translateTexts(textsToTranslate);

                const translatedChunk = chunkToTranslate.map((sub, index) => ({
                    ...sub,
                    text: translatedTexts[index],
                }));
                translatedSubtitles.push(...translatedChunk);
            }

            setTranslationProgress('A finalizar o ficheiro traduzido...');
            setTranslationProgressPercent(100);
            const finalSrt = stringifySrt(translatedSubtitles);
            setTranslatedContent(finalSrt);
            setTranslationProgress('Tradução concluída!');
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Ocorreu um erro desconhecido.';
            setError(errorMessage);
            console.error(e);
        } finally {
            setIsTranslating(false);
        }
    }, [inputFile]);

    const handleDownload = () => {
        if (!translatedContent || !inputFile) return;
        const blob = new Blob([translatedContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = getOutputFilename(inputFile.name);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-indigo-100 font-sans">
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl shadow-indigo-200/50 overflow-hidden">
                <header className="p-6 bg-indigo-600 text-white text-center">
                    <h1 className="text-3xl font-bold">Tradutor de Legendas SRT</h1>
                    <p className="mt-2 text-indigo-200">Traduza as suas legendas para Português Europeu com IA</p>
                </header>

                <main className="p-8 space-y-6">
                    {error && (
                        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
                            <p className="font-bold">Erro</p>
                            <p>{error}</p>
                        </div>
                    )}
                    
                    {!translatedContent ? (
                        <>
                            <div
                                onDragEnter={handleDragEnter}
                                onDragOver={handleDragEnter}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-300 ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'}`}
                            >
                                <Icon name="upload" className="w-12 h-12 text-slate-400 mb-4"/>
                                <p className="text-slate-600 text-center">
                                    <span className="font-semibold text-indigo-600">Clique para carregar</span> ou arraste e solte
                                </p>
                                <p className="text-xs text-slate-500 mt-1">Apenas ficheiros SRT</p>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={(e) => handleFileSelect(e.target.files)}
                                    accept=".srt"
                                    className="hidden"
                                />
                            </div>

                            {inputFile && (
                                <div className="flex items-center justify-between bg-slate-100 p-3 rounded-lg text-sm">
                                    <div className="flex items-center space-x-3">
                                        <Icon name="file" className="w-5 h-5 text-indigo-600"/>
                                        <span className="font-medium text-slate-700">{inputFile.name}</span>
                                    </div>
                                    <button onClick={() => setInputFile(null)} className="p-1 rounded-full hover:bg-slate-200 transition-colors">
                                        <Icon name="close" className="w-4 h-4 text-slate-500"/>
                                    </button>
                                </div>
                            )}

                            <div className="flex flex-col items-center">
                                <button
                                    onClick={handleTranslate}
                                    disabled={!inputFile || isTranslating}
                                    className="w-full flex items-center justify-center space-x-2 bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105"
                                >
                                    {isTranslating ? (
                                        <>
                                            <Icon name="spinner" className="w-5 h-5"/>
                                            <span>A traduzir...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Icon name="translate" className="w-5 h-5"/>
                                            <span>Traduzir Ficheiro</span>
                                        </>
                                    )}
                                </button>
                                {isTranslating && (
                                    <div className="w-full mt-4">
                                        <p className="text-sm text-slate-500 mb-2 text-center">{translationProgress}</p>
                                        <div className="w-full bg-slate-200 rounded-full h-2.5">
                                            <div
                                                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500"
                                                style={{ width: `${translationProgressPercent}%` }}
                                                role="progressbar"
                                                aria-label="Progresso da tradução"
                                                aria-valuenow={translationProgressPercent}
                                                aria-valuemin={0}
                                                aria-valuemax={100}
                                            ></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                         <div className="text-center space-y-6 animate-fade-in">
                            <h2 className="text-2xl font-semibold text-slate-800">Tradução Concluída!</h2>
                             <p className="text-slate-600">{inputFile?.name}</p>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                               <button
                                    onClick={handleDownload}
                                    className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-emerald-500 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:bg-emerald-600 transition-all duration-300 transform hover:scale-105"
                                >
                                    <Icon name="download" className="w-5 h-5"/>
                                    <span>Descarregar Ficheiro Traduzido</span>
                                </button>
                                <button
                                    onClick={resetState}
                                    className="w-full sm:w-auto bg-slate-200 text-slate-700 font-bold py-3 px-6 rounded-lg hover:bg-slate-300 transition-all duration-300"
                                >
                                    Traduzir Outro Ficheiro
                                </button>
                            </div>
                        </div>
                    )}
                </main>
            </div>
            <footer className="mt-8 text-center text-sm text-slate-500">
                <p>Desenvolvido com a API Google Gemini</p>
            </footer>
        </div>
    );
};

export default App;
