
import React, { useState, useCallback, useRef } from 'react';
import { MCQ, TextbookAnalysis, AppStatus, FileData, Part } from './types';
import { GeminiMathService } from './services/geminiService';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [files, setFiles] = useState<FileData[]>([]);
  const [analysis, setAnalysis] = useState<TextbookAnalysis | null>(null);
  const [mcqs, setMcqs] = useState<MCQ[]>([]);
  const [currentPartIndex, setCurrentPartIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const serviceRef = useRef<GeminiMathService | null>(null);

  const getService = () => {
    if (!serviceRef.current) {
      serviceRef.current = new GeminiMathService();
    }
    return serviceRef.current;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files) as File[];
      const fileDataPromises = newFiles.map(file => {
        return new Promise<FileData>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              name: file.name,
              type: file.type,
              base64: reader.result as string
            });
          };
          reader.readAsDataURL(file);
        });
      });

      Promise.all(fileDataPromises).then(results => {
        setFiles(prev => [...prev, ...results]);
      });
    }
  };

  const startAnalysis = async () => {
    if (files.length === 0) return;
    setStatus(AppStatus.ANALYZING);
    setError(null);
    try {
      const result = await getService().analyzeTextbook(files);
      setAnalysis(result);
      setStatus(AppStatus.READY_TO_GENERATE);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to analyze textbook.");
      setStatus(AppStatus.IDLE);
    }
  };

  const generateNextPart = async () => {
    if (!analysis || currentPartIndex >= 4) return;
    setIsGenerating(true);
    setStatus(AppStatus.GENERATING);
    setError(null);
    
    try {
      const newMcqs = await getService().generatePartMCQs(analysis, currentPartIndex, mcqs);
      setMcqs(prev => [...prev, ...newMcqs]);
      
      const nextIndex = currentPartIndex + 1;
      setCurrentPartIndex(nextIndex);
      
      if (nextIndex >= 4) {
        setStatus(AppStatus.COMPLETED);
      } else {
        setStatus(AppStatus.READY_TO_GENERATE);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || `Failed to generate Part ${currentPartIndex + 1}.`);
      setStatus(AppStatus.READY_TO_GENERATE);
    } finally {
      setIsGenerating(false);
    }
  };

  const convertToCSV = (questions: MCQ[]) => {
    const headers = ["Part", "Chapter", "Question", "Option A", "Option B", "Option C", "Option D", "Correct Answer"];
    const rows = questions.map(q => [
      q.partName,
      q.chapterTitle,
      `"${q.question.replace(/"/g, '""')}"`,
      `"${q.options.A.replace(/"/g, '""')}"`,
      `"${q.options.B.replace(/"/g, '""')}"`,
      `"${q.options.C.replace(/"/g, '""')}"`,
      `"${q.options.D.replace(/"/g, '""')}"`,
      q.correctAnswer
    ]);

    return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  };

  const downloadCSV = (index?: number) => {
    const questionsToExport = index !== undefined 
      ? mcqs.filter((_, i) => Math.floor(i / 100) === index)
      : mcqs;
    
    if (questionsToExport.length === 0) return;

    const csvContent = convertToCSV(questionsToExport);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const filename = index !== undefined ? `MathGenius_Part_${index + 1}.csv` : "MathGenius_All_Parts.csv";
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(mcqs, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "MathGenius_Assessment.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <i className="fas fa-square-root-variable text-xl"></i>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">MathGenius</h1>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Expert Assessment Architect</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             {status === AppStatus.COMPLETED && (
               <div className="flex gap-2">
                 <button 
                  onClick={() => downloadCSV()}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition shadow-sm text-sm font-semibold"
                 >
                   <i className="fas fa-file-csv"></i> Export All CSV
                 </button>
                 <button 
                  onClick={downloadJSON}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-sm text-sm font-semibold"
                 >
                   <i className="fas fa-file-code"></i> Export JSON
                 </button>
               </div>
             )}
             <div className="text-sm px-3 py-1 bg-gray-100 rounded-full font-medium text-gray-600 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${status === AppStatus.COMPLETED ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></span>
                {status === AppStatus.READY_TO_GENERATE ? `Ready Part ${currentPartIndex + 1}` : status.replace(/_/g, ' ')}
             </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 space-y-8">
        {/* Step 1: Upload & Initial Analysis */}
        {status === AppStatus.IDLE && (
          <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl border p-8 space-y-6 text-center">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-gray-900">Mathematics Assessment Generator</h2>
              <p className="text-gray-500">Upload your complete textbook. Our AI will divide the curriculum into 4 logical parts and generate 400 unique MCQs.</p>
            </div>
            
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-10 bg-gray-50 group hover:border-indigo-400 transition-colors">
              <input 
                type="file" 
                multiple 
                accept="application/pdf,image/*" 
                onChange={handleFileUpload}
                className="hidden" 
                id="file-upload" 
              />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 text-gray-400 group-hover:text-indigo-500 transition-colors">
                  <i className="fas fa-cloud-upload-alt text-2xl"></i>
                </div>
                <span className="text-gray-700 font-bold text-lg">Upload Textbook Content</span>
                <span className="text-sm text-gray-400 mt-1">Select PDF or Chapter Images</span>
              </label>
            </div>

            {files.length > 0 && (
              <div className="text-left space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs p-3 bg-white border rounded-lg border-gray-100 shadow-sm truncate">
                      <i className="fas fa-file-invoice text-indigo-400"></i>
                      <span className="truncate flex-1 font-medium">{f.name}</span>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={startAnalysis}
                  className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 text-lg"
                >
                  <i className="fas fa-wand-sparkles"></i> Analyze & Plan Assessment
                </button>
              </div>
            )}
          </div>
        )}

        {/* Loading / Analyzing State */}
        {status === AppStatus.ANALYZING && (
          <div className="max-w-md mx-auto text-center py-24 space-y-8">
            <div className="relative flex justify-center">
               <div className="w-32 h-32 border-[6px] border-indigo-50 border-t-indigo-600 rounded-full animate-spin"></div>
               <div className="absolute inset-0 flex items-center justify-center">
                 <i className="fas fa-book-open text-indigo-600 text-4xl animate-bounce"></i>
               </div>
            </div>
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-gray-900">Building Curriculum Map...</h2>
              <div className="flex flex-col gap-2 max-w-xs mx-auto">
                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 animate-[loading_2s_ease-in-out_infinite]" style={{width: '60%'}}></div>
                </div>
                <p className="text-sm text-gray-500 animate-pulse font-medium">Extracting chapters and logical parts</p>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard View */}
        {(status !== AppStatus.IDLE && status !== AppStatus.ANALYZING) && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
            {/* Sidebar: Parts Division Display */}
            <aside className="lg:col-span-1 space-y-6 lg:sticky lg:top-24">
              <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-6">
                <div className="flex items-center justify-between border-b pb-4">
                  <h3 className="font-black text-gray-900 uppercase tracking-widest text-xs">Curriculum Parts</h3>
                  <i className="fas fa-map text-indigo-500"></i>
                </div>
                <div className="space-y-4">
                  {analysis?.parts.map((p, i) => (
                    <div key={i} className={`p-4 rounded-xl border-2 transition-all ${currentPartIndex === i ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-transparent opacity-80'}`}>
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${currentPartIndex === i ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                          {i + 1}
                        </span>
                        <h4 className="font-bold text-gray-800 text-sm">{p.name}</h4>
                      </div>
                      <div className="space-y-1 pl-11">
                        {p.chapterTitles.map((ch, ci) => (
                          <div key={ci} className="text-[10px] text-gray-500 flex items-center gap-1">
                            <i className="fas fa-circle text-[4px] text-gray-300"></i>
                            {ch}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900 rounded-2xl shadow-xl p-6 text-white space-y-5 overflow-hidden relative">
                <div className="relative z-10 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-black tracking-[0.2em] text-indigo-400">Total Generated</span>
                    <span className="text-2xl font-black">{mcqs.length} <span className="text-sm text-slate-500">/ 400</span></span>
                  </div>
                  <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden border border-slate-700 p-[2px]">
                    <div 
                      className="bg-gradient-to-r from-indigo-500 to-indigo-300 h-full rounded-full transition-all duration-1000" 
                      style={{ width: `${(mcqs.length / 400) * 100}%` }}
                    ></div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[0, 1, 2, 3].map(i => (
                      <div 
                        key={i} 
                        className={`h-1.5 rounded-full transition-colors ${currentPartIndex > i ? 'bg-emerald-400' : currentPartIndex === i ? 'bg-amber-400 animate-pulse' : 'bg-slate-700'}`}
                      ></div>
                    ))}
                  </div>
                </div>
                <div className="absolute -right-4 -bottom-4 text-slate-800 text-8xl opacity-10">
                  <i className="fas fa-percent"></i>
                </div>
              </div>
            </aside>

            {/* Main Area: MCQ Display & Controls */}
            <div className="lg:col-span-3 space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r-xl flex items-center gap-4 shadow-sm">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600 flex-shrink-0">
                    <i className="fas fa-exclamation-triangle"></i>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm">Action Required</p>
                    <p className="text-xs opacity-80">{error}</p>
                  </div>
                </div>
              )}

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-white p-8 rounded-2xl border shadow-sm gap-6">
                <div className="space-y-1">
                  <h2 className="text-2xl font-black text-gray-900">
                    {status === AppStatus.COMPLETED ? 'Assessment Complete' : `Generating ${analysis?.parts[currentPartIndex]?.name}`}
                  </h2>
                  <p className="text-gray-500 font-medium">
                    {status === AppStatus.COMPLETED 
                      ? '400 precision MCQs distributed across 4 logical book parts.' 
                      : `Step ${currentPartIndex + 1} of 4: Generating the next 100 questions for chapters in this part.`}
                  </p>
                </div>
                {status !== AppStatus.COMPLETED && (
                  <button
                    disabled={isGenerating}
                    onClick={generateNextPart}
                    className={`px-8 py-4 rounded-xl font-black text-white shadow-xl transition-all flex items-center gap-3 whitespace-nowrap active:scale-95 ${
                      isGenerating ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                    }`}
                  >
                    {isGenerating ? (
                      <>
                        <i className="fas fa-gear animate-spin"></i> GENERATING...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-wand-magic-sparkles"></i> GENERATE PART {currentPartIndex + 1}
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Part Groups Display */}
              <div className="space-y-12">
                {[0, 1, 2, 3].map(partIdx => {
                  const partQuestions = mcqs.filter((_, i) => Math.floor(i / 100) === partIdx);
                  if (partQuestions.length === 0) return null;

                  return (
                    <section key={partIdx} className="space-y-6">
                      <div className="flex items-center justify-between border-b pb-4">
                        <div className="flex items-center gap-3">
                          <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg font-black text-sm">PART {partIdx + 1}</span>
                          <h3 className="text-xl font-bold text-gray-800">{analysis?.parts[partIdx].name}</h3>
                        </div>
                        <button 
                          onClick={() => downloadCSV(partIdx)}
                          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 transition-colors"
                        >
                          <i className="fas fa-file-csv"></i> Download Part {partIdx + 1} CSV
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-6">
                        {partQuestions.map((mcq, idx) => (
                          <div key={mcq.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6 relative overflow-hidden group hover:border-indigo-200 transition-colors">
                            <div className="flex flex-wrap items-center gap-3 relative z-10">
                              <span className="px-2.5 py-1 bg-slate-100 rounded text-[9px] font-black text-slate-500 uppercase tracking-widest border border-slate-200">
                                Q{idx + 1 + (partIdx * 100)}
                              </span>
                              <span className="px-2.5 py-1 bg-indigo-50 rounded text-[9px] font-bold text-indigo-600 uppercase border border-indigo-100">
                                {mcq.chapterTitle}
                              </span>
                              <span className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase border ${
                                mcq.difficulty === 'Challenging' ? 'bg-rose-50 text-rose-600 border-rose-100' : 
                                mcq.difficulty === 'Moderate' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                              }`}>
                                {mcq.difficulty}
                              </span>
                            </div>

                            <h4 className="text-xl font-bold text-gray-900 leading-snug math-font relative z-10">
                              {mcq.question}
                            </h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                              {Object.entries(mcq.options).map(([key, val]) => (
                                <div 
                                  key={key} 
                                  className={`p-4 rounded-xl border-2 text-sm transition-all flex items-center gap-4 ${
                                    mcq.correctAnswer === key 
                                      ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold shadow-sm' 
                                      : 'bg-white border-gray-100 text-gray-600'
                                  }`}
                                >
                                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                                    mcq.correctAnswer === key ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'
                                  }`}>
                                    {key}
                                  </span>
                                  <span className="math-font flex-1">{val}</span>
                                  {mcq.correctAnswer === key && <i className="fas fa-check-circle text-emerald-500 text-lg"></i>}
                                </div>
                              ))}
                            </div>

                            {mcq.explanation && (
                              <div className="bg-slate-50 p-4 rounded-xl text-xs text-slate-500 leading-relaxed border border-slate-100">
                                <span className="font-black text-slate-400 uppercase tracking-widest text-[9px] block mb-1">Pedagogical Insight</span>
                                {mcq.explanation}
                              </div>
                            )}

                            {/* Watermark bg */}
                            <div className="absolute top-0 right-0 p-4 text-gray-50 opacity-10 select-none">
                              <i className="fas fa-calculator text-6xl rotate-12"></i>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })}

                {isGenerating && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4 animate-pulse">
                      <div className="h-8 w-48 bg-gray-200 rounded"></div>
                    </div>
                    {[1, 2, 3].map(i => (
                      <div key={i} className="bg-white rounded-2xl h-48 animate-pulse border"></div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-white border-t py-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 grayscale opacity-50">
            <i className="fas fa-microchip text-2xl"></i>
            <span className="font-black tracking-tighter text-sm">ASSESSMENT POWERED BY GEMINI 3.0</span>
          </div>
          <p className="text-xs font-bold text-gray-400 tracking-wide">DESIGNED FOR MATHEMATICS EDUCATORS & EXAMINERS</p>
          <div className="flex gap-4">
             <a href="#" className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 hover:text-indigo-600 transition"><i className="fab fa-github"></i></a>
             <a href="#" className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 hover:text-indigo-600 transition"><i className="fab fa-twitter"></i></a>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
};

export default App;
