// ==========================================
// 🌸 components.js: React 子组件群 (完整版)
// ==========================================

// 🌸 全局解构 React Hooks，供所有组件使用
const { useState, useEffect, useRef } = React;

/* 🌸 中文注释：修复后的查词弹窗 - 完美兼容数组(英)和对象(日)结构 */
function DictModal({ word, onClose }) {
    const [searchTerm, setSearchTerm] = useState(word || '');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [currentLoadedFile, setCurrentLoadedFile] = useState(null); 

    const handleSearch = async (term) => {
        if (!term) return;
        const lowerTerm = term.toLowerCase().trim();
        
        const isJapanese = /[\u3040-\u30ff\u4e00-\u9fa5]/.test(lowerTerm);
        const targetFile = isJapanese ? 'jp' : (/^[a-z]/.test(lowerTerm) ? lowerTerm[0] : 'misc');

        setLoading(true);
        try {
            let data = window.activeDictBuffer;

            if (currentLoadedFile !== targetFile) {
                const res = await fetch(`dict/${targetFile}.json`);
                if (!res.ok) throw new Error('词库文件不存在');
                data = await res.json();
                window.activeDictBuffer = data; 
                setCurrentLoadedFile(targetFile); 
            }

            let match = null;

            if (isJapanese) {
                const list = data.words || []; 
                const entry = list.find(w => 
                    (w.kanji && w.kanji.some(k => lowerTerm.startsWith(k.text))) || 
                    (w.kana && w.kana.some(k => lowerTerm.startsWith(k.text)))
                );
                
                if (entry) {
                    match = {
                        word: entry.kanji && entry.kanji.length > 0 ? entry.kanji[0].text : entry.kana[0].text,
                        phonetic: entry.kana && entry.kana.length > 0 ? entry.kana[0].text : '',
                        translation: entry.sense.map((s, idx) => {
                            const glossText = s.gloss.map(g => (typeof g === 'object' ? g.text : g)).join('；');
                            return `${idx + 1}. ${glossText}`;
                        }).join('\n')
                    };
                }
            } else {
                const list = Array.isArray(data) ? data : [];
                match = list.find(item => item.word && item.word.toLowerCase() === lowerTerm) || 
                        list.find(item => item.word && item.word.toLowerCase().startsWith(lowerTerm));
            }

            setResult(match || { error: '未找到该词汇' });
        } catch (err) {
            console.error(err);
            setResult({ error: `加载失败: 请检查 dict/${targetFile}.json 是否存在` });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { if (word) handleSearch(word); }, []);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center modal-enter" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-[90%] md:w-[500px] max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-4 bg-indigo-600 text-white flex items-center gap-3">
                    <i className="fas fa-book"></i>
                    <input 
                        className="flex-1 bg-white/20 text-white placeholder-white/70 rounded-lg px-3 py-1.5 outline-none font-bold"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch(searchTerm)}
                        placeholder="输入单词..."
                        autoFocus
                    />
                    <button onClick={() => handleSearch(searchTerm)} className="text-white hover:bg-white/20 p-2 rounded-lg"><i className="fas fa-search"></i></button>
                    <button onClick={onClose} className="text-white/70 hover:text-white ml-2"><i className="fas fa-times"></i></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-gray-50">
                    {loading && <div className="text-center text-gray-400 py-10"><i className="fas fa-spinner fa-spin mr-2"></i>正在加载离线词库...</div>}
                    
                    {!loading && result && !result.error && (
                        <div className="space-y-4">
                            <div className="flex items-baseline justify-between">
                                <h2 className="text-3xl font-bold text-indigo-700 font-sans">{result.word}</h2>
                                <span className="text-gray-400 font-mono text-sm">[{result.phonetic || '暂无音标'}]</span>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap font-medium">{result.translation?.replace(/\\n/g, '\n')}</p>
                            </div>
                            {result.definition && (
                                <div className="text-xs text-gray-500 bg-gray-100 p-3 rounded-lg">
                                    <div className="font-bold mb-1">英文释义：</div>
                                    {result.definition}
                                </div>
                            )}
                        </div>
                    )}

                    {!loading && result && result.error && (
                        <div className="text-center text-gray-400 py-10 flex flex-col items-center">
                            <i className="fas fa-face-frown-open text-4xl mb-3 text-gray-300"></i>
                            <p>{result.error}</p>
                        </div>
                    )}
                    
                    {!loading && !result && (
                        <div className="text-center text-gray-300 py-10">
                            <i className="fas fa-keyboard text-4xl mb-3 opacity-50"></i>
                            <p>输入单词并回车搜索</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/* 🌸 中文注释：修复后的划词气泡 */
function DictBubble({ config, onClose }) {
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const startPos = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const search = async () => {
            if (!config.word) return;
            const lowerTerm = config.word.toLowerCase().trim();
            const isJapanese = /[\u3040-\u30ff\u4e00-\u9fa5]/.test(lowerTerm);
            const fileName = isJapanese ? 'jp' : (/^[a-z]/.test(lowerTerm) ? lowerTerm[0] : 'misc');

            try {
                let data = window.activeDictBuffer;
                if (!data || window.lastLoadedFile !== fileName) {
                    console.log("正在尝试加载本地词典文件:", `dict/${fileName}.json`);
                    const res = await fetch(`dict/${fileName}.json`);
                    if (!res.ok) throw new Error(`找不到文件: dict/${fileName}.json，请检查文件名是否为全小写。`);
                    data = await res.json();
                    window.activeDictBuffer = data;
                    window.lastLoadedFile = fileName;
                }

                let match = null;
                if (isJapanese) {
                    const list = data.words || [];
                    const entry = list.find(w => 
                        (w.kanji && w.kanji.some(k => lowerTerm.startsWith(k.text))) || 
                        (w.kana && w.kana.some(k => lowerTerm.startsWith(k.text)))
                    );
                    if (entry) {
                        match = {
                            word: entry.kanji && entry.kanji.length > 0 ? entry.kanji[0].text : entry.kana[0].text,
                            phonetic: entry.kana && entry.kana.length > 0 ? entry.kana[0].text : '',
                            translation: entry.sense.slice(0, 2).map((s, i) => {
                                const text = s.gloss.map(g => (typeof g === 'object' ? g.text : g)).join('; ');
                                return `${i + 1}. ${text}`;
                            }).join('\n')
                        };
                    }
                } else {
                    const list = Array.isArray(data) ? data : [];
                    match = list.find(item => item.word && item.word.toLowerCase() === lowerTerm) || 
                            list.find(item => item.word && item.word.toLowerCase().startsWith(lowerTerm));
                }
                
                setResult(match || { error: `词库里没找到 "${lowerTerm}"` });

            } catch (e) {
                console.error("词库读取报错:", e);
                setResult({ error: e.message });
            } finally {
                setLoading(false);
            }
        };
        search();
    }, [config.word]);

    return (
        <div className="fixed inset-0 z-[100]" onClick={onClose} 
             onMouseMove={(e) => {
                 if (!isDragging) return;
                 setDragOffset({ x: e.clientX - startPos.current.x, y: e.clientY - startPos.current.y });
             }}
             onMouseUp={() => setIsDragging(false)}
        >
            <div 
                className="absolute bg-white dark:bg-zinc-800 shadow-2xl rounded-2xl border border-gray-100 dark:border-zinc-700 min-w-[180px] max-w-[280px] overflow-hidden animate-in zoom-in-95 duration-200"
                style={{ 
                    left: (Math.max(10, Math.min(window.innerWidth - 290, config.x - 140)) + dragOffset.x) + 'px', 
                    top: (Math.min(window.innerHeight - 150, config.y + 8) + dragOffset.y) + 'px',
                    touchAction: 'none'
                }}
                onClick={e => e.stopPropagation()}
            >
                <div className="h-2 bg-gray-50 dark:bg-zinc-700 cursor-move hover:bg-indigo-100 transition" onMouseDown={(e) => { setIsDragging(true); startPos.current = { x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y }; }}></div>
                <div className="p-4">
                    {loading ? (
                        <div className="text-[10px] text-gray-400"><i className="fas fa-spinner fa-spin mr-2"></i></div>
                    ) : result?.error ? (
                        <div className="text-[10px] text-rose-400 font-bold">❌ {result.error}</div>
                    ) : (
                        <div className="space-y-1">
                            <div className="flex justify-between items-center gap-2">
                                <span className="font-bold text-indigo-600 dark:text-indigo-400 truncate text-sm">{result.word}</span>
                                <span className="text-[9px] text-gray-400 font-mono">[{result.phonetic}]</span>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-300 leading-snug line-clamp-4 border-t dark:border-zinc-700 pt-2 mt-1 whitespace-pre-wrap">{result.translation}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/* 🌸 中文注释：主编辑器视图 */
function EditorView({ onCreatePage, notebook, page, onBack, onSave, onAddCard, setModal, onPrintClick, showToast, allCategories, onSwitchPage, pendingHighlight, setPendingHighlight, isDarkMode, setIsDarkMode }) {
    const [showColorMenu, setShowColorMenu] = useState(false);
    const [colorMenuPos, setColorMenuPos] = useState({ x: 0, y: 0 });
    const colorInputRef = useRef(null);

    const applyTextColor = (color) => {
        const restored = restoreSelection(); 
        if (!restored && contentRef.current) contentRef.current.focus();
        document.execCommand('foreColor', false, color);
        saveSelection();
        handleInput(false, true);
    };

    const [noteOffset, setNoteOffset] = useState({ x: 0, y: 0 });
    const [isDraggingNote, setIsDraggingNote] = useState(false);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const [studyMode, setStudyMode] = useState(false);
    const [isMdMode, setIsMdMode] = useState(false);
    const [mdContent, setMdContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [activeRemover, setActiveRemover] = useState(null);
    const [activeNote, setActiveNote] = useState(null);
    const [showSidebar, setShowSidebar] = useState(false);
    const [sidebarMode, setSidebarMode] = useState('toc');
    const [showReplaceBar, setShowReplaceBar] = useState(false);
    const [replaceMode, setReplaceMode] = useState(false);
    const [selPop, setSelPop] = useState(null);
    const [browserUrl, setBrowserUrl] = useState(null);
    const [sidebarFoldedIds, setSidebarFoldedIds] = useState(new Set());
    const [isOutlineEditMode, setIsOutlineEditMode] = useState(false);
    const [activeImg, setActiveImg] = useState(null);
    const fileInputRef = useRef(null);
    const [appZoom, setAppZoom] = useState(1);
    const [zoomInput, setZoomInput] = useState('100');
    const [historyStack, setHistoryStack] = useState([page?.content || '']);
    const [historyStep, setHistoryStep] = useState(0);
    const historyTimer = useRef(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [replaceQuery, setReplaceQuery] = useState('');
    const contentRef = useRef(null);
    const savedRange = useRef(null);

    const extractOutline = () => {
        if (!contentRef.current) return [];
        const headers = contentRef.current.querySelectorAll('h1, h2, h3');
        const outline = [];
        let currentH1Folded = false;
        let currentH2Folded = false;

        headers.forEach((h, i) => {
            h.id = `heading-${i}`;
            const tag = h.tagName.toUpperCase();
            const isFoldedInSidebar = sidebarFoldedIds.has(h.id);
            let isVisible = true;

            if (tag === 'H1') {
                isVisible = true;
                currentH1Folded = isFoldedInSidebar;
                currentH2Folded = false;
            } else if (tag === 'H2') {
                isVisible = !currentH1Folded;
                currentH2Folded = isFoldedInSidebar;
            } else if (tag === 'H3') {
                isVisible = !currentH1Folded && !currentH2Folded;
            }

            outline.push({ id: h.id, tag: tag, collapsed: isFoldedInSidebar, text: h.innerText || '无标题', el: h, isVisible: isVisible });
        });
        return outline;
    };

    useEffect(() => {
        window.triggerLocalFind = () => {
            setShowReplaceBar(true);
            setTimeout(() => {
                const input = document.querySelector('input[placeholder="输入关键字..."]');
                if(input) input.focus();
            }, 50);
        };
        return () => { window.triggerLocalFind = null; };
    }, []);

    useEffect(() => { setZoomInput(Math.round(appZoom * 100).toString()); }, [appZoom]);

    const handleZoomCommit = () => {
        let val = parseInt(zoomInput);
        if (isNaN(val)) val = 100;
        val = Math.max(50, Math.min(300, val));
        setAppZoom(val / 100);
        setZoomInput(val.toString());
        showToast(`缩放已设定：${val}%`, 'success');
    };

    const handleAppZoom = (delta) => {
        const newZoom = parseFloat((appZoom + delta).toFixed(1));
        if (newZoom < 0.5 || newZoom > 3.0) return;
        setAppZoom(newZoom);
        showToast(`正文缩放：${Math.round(newZoom * 100)}%`, 'info');
    };

    const performUndo = () => {
        if (historyStep > 0) {
            const prevStep = historyStep - 1;
            const prevHtml = historyStack[prevStep];
            if (prevHtml === undefined || prevHtml === null) { setHistoryStep(prevStep); return; }
            contentRef.current.innerHTML = prevHtml;
            setHistoryStep(prevStep);
            handleInput(true); 
            showToast('已撤销');
        }
    };

    const revertToSnapshot = () => {
        if (!page.snapshot) { showToast('尚未创建过恢复点', 'warning'); return; }
        setModal({
            type: 'confirm', title: '回档确认', msg: '确定要放弃当前所有修改，回到上一次手动保存的状态吗？',
            onConfirm: () => {
                contentRef.current.innerHTML = page.snapshot;
                handleInput(false, true);
                showToast('已恢复至手动存档状态', 'success');
            }
        });
    };

    const performRedo = () => {
        if (historyStep < historyStack.length - 1) {
            const nextStep = historyStep + 1;
            const nextHtml = historyStack[nextStep];
            contentRef.current.innerHTML = nextHtml;
            setHistoryStep(nextStep);
            handleInput(true);
            showToast('已重做');
        }
    };

    const pushHistory = (html, immediate = false) => {
        if (historyTimer.current) clearTimeout(historyTimer.current);
        const saveAction = () => {
            setHistoryStack(prev => {
                const newStack = prev.slice(0, historyStep + 1);
                newStack.push(html);
                if (newStack.length > 50) newStack.shift();
                return newStack;
            });
            setHistoryStep(prev => Math.min(prev + 1, 49));
        };
        if (immediate) saveAction(); else historyTimer.current = setTimeout(saveAction, 800);
    };

    const insertCompressedImage = (blob) => {
        if (!blob) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const maxWidth = 800;
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
                canvas.width = width; canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                if(contentRef.current) contentRef.current.focus();
                document.execCommand('insertImage', false, dataUrl);
                handleInput(false, true); 
                showToast('图片已插入', 'success');
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(blob);
    };

    const handleImageUpload = (e) => { const file = e.target.files[0]; if (file) { insertCompressedImage(file); e.target.value = ''; } };
    const handlePaste = (e) => {
        const items = e.clipboardData && e.clipboardData.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                e.preventDefault();
                insertCompressedImage(items[i].getAsFile());
                return;
            }
        }
    };

    const removeNote = (target) => {
        if (!target) return;
        const parent = target.parentNode;
        while (target.firstChild) parent.insertBefore(target.firstChild, target);
        parent.removeChild(target);
        handleInput(); setActiveNote(null); showToast('批注已删除', 'info');
    };

    const expandJapaneseSelection = () => {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        const node = range.startContainer;
        if (node.nodeType !== Node.TEXT_NODE) return;
        const text = node.textContent;
        const start = range.startOffset;
        const isJapaneseChar = (char) => /[\u3040-\u30ff\u4e00-\u9fa5\u3005\u30fc]/.test(char);
        if (!isJapaneseChar(text[start]) && !isJapaneseChar(text[start - 1])) return;
        let newStart = start; let newEnd = range.endOffset; let leftStep = 0; let rightStep = 0;
        const MAX_STEPS = 5; 
        const isPunctuation = (c) => /[，。！？、；：""''（）()[\]{}<>\s]/.test(c);
        while (newStart > 0 && leftStep < MAX_STEPS && isJapaneseChar(text[newStart - 1]) && !isPunctuation(text[newStart-1])) { newStart--; leftStep++; }
        while (newEnd < text.length && rightStep < MAX_STEPS && isJapaneseChar(text[newEnd]) && !isPunctuation(text[newEnd])) { newEnd++; rightStep++; }
        const newRange = document.createRange(); newRange.setStart(node, newStart); newRange.setEnd(node, newEnd);
        sel.removeAllRanges(); sel.addRange(newRange);
        return text.substring(newStart, newEnd);
    }; 

    const extractNotes = () => {
        if (!page || !page.content) return [];
        const doc = new DOMParser().parseFromString(page.content, 'text/html');
        const noteNodes = doc.querySelectorAll('.note-link');
        return Array.from(noteNodes).map((node, index) => ({ id: index, original: node.innerText, note: node.getAttribute('data-note') || '' }));
    };

    useEffect(() => {
        if (page && contentRef.current) {
            if (contentRef.current.innerHTML !== page.content) contentRef.current.innerHTML = page.content;
            if (window.renderMathInElement) window.renderMathInElement(contentRef.current, { delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}], throwOnError: false });
        }
    }, [page?.id]);

    const handleInput = (skipHistory = false, immediate = false) => {
        const html = contentRef.current.innerHTML;
        if (!isSaving) { setIsSaving(true); onSave(html); setTimeout(() => setIsSaving(false), 500); }
        if (!skipHistory) pushHistory(html, immediate);
    };

    const format = (cmd, val = null) => { document.execCommand(cmd, false, val); contentRef.current.focus(); handleInput(false, true); };
    const saveSelection = () => { const sel = window.getSelection(); if (sel && sel.rangeCount > 0) savedRange.current = sel.getRangeAt(0).cloneRange(); };
    const restoreSelection = () => { const sel = window.getSelection(); if (savedRange.current) { sel.removeAllRanges(); sel.addRange(savedRange.current); return true; } return false; };

    const executeFind = (query) => {
        if (!query) return;
        const editor = contentRef.current;
        if (document.activeElement !== editor) editor.focus();
        const found = window.find(query, false, false, false);
        if (found) {
            const sel = window.getSelection();
            if (sel.rangeCount > 0) {
                let el = sel.getRangeAt(0).commonAncestorContainer;
                if (el.nodeType === 3) el = el.parentElement; 
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return true;
        }
        const foundFromTop = window.find(query, false, false, true);
        if (!foundFromTop) { showToast('未找到匹配内容', 'error'); return false; } else {
            const sel = window.getSelection();
            if (sel.rangeCount > 0) {
                let el = sel.getRangeAt(0).commonAncestorContainer;
                if (el.nodeType === 3) el = el.parentElement;
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            showToast('已到文档末尾，从开头继续检索', 'info');
        }
        return true;
    };

    const handleReplace = () => {
        const editor = contentRef.current;
        if (document.activeElement !== editor) editor.focus();
        const sel = window.getSelection();
        if (sel.toString().toLowerCase() === searchQuery.toLowerCase() && searchQuery !== '') {
            document.execCommand('insertText', false, replaceQuery); handleInput(); showToast('已替换', 'success');
        }
        executeFind(searchQuery);
    };

    const handleReplaceAll = () => {
        if (!searchQuery) return;
        const editor = contentRef.current;
        const escapedSearch = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedSearch, 'gi');
        editor.innerHTML = editor.innerHTML.replace(regex, replaceQuery);
        handleInput(); showToast('已完成全部替换', 'success');
    };

    const resetBlock = () => {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        if (document.queryCommandState('insertUnorderedList')) document.execCommand('insertUnorderedList', false, null);
        if (document.queryCommandState('insertOrderedList')) document.execCommand('insertOrderedList', false, null);
        document.execCommand('formatBlock', false, 'P');
        document.execCommand('removeFormat');
        const range = sel.getRangeAt(0);
        let block = range.commonAncestorContainer;
        while (block && block.nodeType === 3) block = block.parentNode;
        if (block && block !== contentRef.current && block.classList) block.removeAttribute('class');
    };

    const applyHeading = (tag) => { resetBlock(); setTimeout(() => { format('formatBlock', tag); }, 10); };
    const applyFontSize = (sizeVal) => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed) { showToast('请先选择文字', 'warning'); return; }
        if (sizeVal === 'default') { document.execCommand('removeFormat'); } else {
            const span = document.createElement('span'); span.style.fontSize = sizeVal;
            try {
                const range = sel.getRangeAt(0); span.appendChild(range.extractContents()); range.insertNode(span);
                const newRange = document.createRange(); newRange.selectNodeContents(span); sel.removeAllRanges(); sel.addRange(newRange);
                handleInput(false, true);
            } catch (e) { showToast('请在同一段落内调整字号', 'error'); }
        }
    };

    const handleFoldClick = (e) => {
        const target = e.target;
        if (!['H1', 'H2'].includes(target.tagName)) return;
        const rect = target.getBoundingClientRect();
        if (e.clientX > rect.left + 20) return;
        target.classList.toggle('collapsed');
        const isCollapsed = target.classList.contains('collapsed');
        const level = parseInt(target.tagName[1]);
        let next = target.nextElementSibling;
        while (next) {
            if (/^H[1-6]$/.test(next.tagName)) { const nextLevel = parseInt(next.tagName[1]); if (nextLevel <= level) break; }
            if (isCollapsed) { next.setAttribute('data-original-display', next.style.display); next.style.display = 'none'; } else { next.style.display = next.getAttribute('data-original-display') || ''; }
            next = next.nextElementSibling;
        }
    };

    useEffect(() => {
        if (page && pendingHighlight && contentRef.current) {
            const { term, index } = pendingHighlight; setPendingHighlight(null);
            setTimeout(() => {
                const editor = contentRef.current; editor.focus();
                const sel = window.getSelection(); sel.collapse(editor, 0);
                for (let i = 0; i <= index; i++) { const found = window.find(term, false, false, false); if (!found) break; }
                if (sel.rangeCount > 0) {
                    let el = sel.getRangeAt(0).commonAncestorContainer;
                    if (el.nodeType === 3) el = el.parentElement;
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    try {
                        const span = document.createElement('span'); span.className = 'search-target-highlight';
                        sel.getRangeAt(0).surroundContents(span);
                        setTimeout(() => {
                            if (span.parentNode) {
                                const parent = span.parentNode;
                                while (span.firstChild) parent.insertBefore(span.firstChild, span);
                                parent.removeChild(span); parent.normalize();
                            }
                        }, 2500);
                    } catch (e) { console.log('跨标签高亮跳过，仅滚动'); }
                }
            }, 500);
        }
    }, [page?.id, pendingHighlight]);

    const applyTag = (cls) => {
        let sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
            if (!restoreSelection()) { showToast('请先划选文字', 'warning'); return; }
            sel = window.getSelection();
        }
        const range = sel.getRangeAt(0); const span = document.createElement('span'); span.className = cls;
        try { span.appendChild(range.extractContents()); range.insertNode(span); sel.removeAllRanges(); handleInput(false, true); } catch (e) { showToast('划选范围太复杂啦，请尝试在段落内划选', 'error'); }
    };

    const themeColor = COLORS[notebook?.colorIdx] || COLORS[0];

    return (
        <div className="flex flex-col h-full bg-white relative">
            <header className="shrink-0 flex flex-col bg-white z-20 no-print shadow-sm border-b">
                <div className="flex items-center justify-between w-full px-2 h-12 border-b border-gray-50">
                    <div className="flex items-center gap-1 shrink-0">
                        <button onClick={onBack} className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-400"><i className="fas fa-chevron-left"></i></button>
                        <div className="flex items-center gap-1 mx-1">
                            <span className="hidden md:block font-bold text-gray-700 truncate max-w-[150px]">{page?.title}</span>
                            <div className="flex items-center gap-1 ml-1">
                                <button onClick={(e) => { e.stopPropagation(); const html = contentRef.current.innerHTML; const newData = {...notebook}; const pg = newData.pages.find(p => p.id === page.id); if(pg) { pg.content = html; pg.snapshot = html; } onSave(html); page.snapshot = html; showToast('恢复点已创建', 'success'); }} className={`px-2 py-0.5 rounded-md flex items-center gap-1 text-[10px] font-bold border bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 transition-all`} title="创建恢复点（存档）"><i className="fas fa-camera"></i><span className="hidden md:inline">存档</span></button>
                                <button onClick={(e) => { e.stopPropagation(); revertToSnapshot(); }} className={`px-2 py-0.5 rounded-md flex items-center gap-1 text-[10px] font-bold border ${page?.snapshot ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100' : 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'}`} title="回滚到上一次存档"><i className="fas fa-clock-rotate-left"></i><span className="hidden md:inline">回滚</span></button>
                            </div>
                        </div>
                        <button onClick={() => window.triggerSticky()} className="w-7 h-7 rounded-lg flex items-center justify-center transition text-yellow-500 hover:bg-yellow-50 mr-1" title="打开小抄本"><i className="fas fa-note-sticky text-xs"></i></button>
                        <button onClick={() => setShowSidebar(!showSidebar)} className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${showSidebar ? themeColor.bg + ' ' + themeColor.text : 'text-gray-400'}`}><i className="fas fa-list-ul text-xs"></i></button>
                        <button onClick={() => setShowReplaceBar(!showReplaceBar)} className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${showReplaceBar ? 'bg-amber-100 text-amber-600' : 'text-gray-400'}`}><i className="fas fa-search text-xs"></i></button>
                        <div className="flex gap-0.5 border-l pl-1 ml-1">
                            <button onClick={performUndo} disabled={historyStep <= 0} className={`w-7 h-7 flex items-center justify-center transition ${historyStep > 0 ? 'text-indigo-600 hover:bg-indigo-50' : 'text-gray-200 cursor-not-allowed'}`}><i className="fas fa-undo text-xs"></i></button>
                            <button onClick={performRedo} disabled={historyStep >= historyStack.length - 1} className={`w-7 h-7 flex items-center justify-center transition ${historyStep < historyStack.length - 1 ? 'text-indigo-600 hover:bg-indigo-50' : 'text-gray-200 cursor-not-allowed'}`}><i className="fas fa-redo text-xs"></i></button>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onMouseDown={(e)=>e.preventDefault()} onClick={()=>{
                            const sel = window.getSelection(); if(!sel || sel.rangeCount===0 || sel.isCollapsed){showToast('请先划选文字','warning');return;}
                            const range = sel.getRangeAt(0).cloneRange();
                            setModal({type:'input', title:'添加批注', onConfirm:(text)=>{
                                if(!text)return; const fragment = range.extractContents();
                                const wrapTextNodes = (domNode) => {
                                    if (domNode.nodeType === 3) { if (!domNode.textContent.trim()) return domNode; const span = document.createElement('span'); span.className = 'note-link'; span.setAttribute('data-note', text); span.textContent = domNode.textContent; return span; } else if (domNode.nodeType === 1) { Array.from(domNode.childNodes).forEach(child => { const newChild = wrapTextNodes(child); if (newChild !== child) { domNode.replaceChild(newChild, child); } }); return domNode; } return domNode;
                                };
                                Array.from(fragment.childNodes).forEach(node => { const newNode = wrapTextNodes(node); if (newNode !== node) { fragment.replaceChild(newNode, node); } });
                                range.insertNode(fragment); handleInput(false, true); showToast('已添加跨段批注', 'success');
                            }});
                        }} className="w-8 h-8 flex items-center justify-center text-rose-400"><i className="fas fa-comment-medical"></i></button>
                        <button onClick={()=>setIsDarkMode(!isDarkMode)} className={`w-8 h-8 flex items-center justify-center ${isDarkMode?'text-yellow-500':'text-gray-400'}`}><i className={`fas ${isDarkMode?'fa-sun':'fa-moon'}`}></i></button>
                        <button onClick={() => {
                            if (!isMdMode) {
                                const turndownService = new window.TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
                                setMdContent(turndownService.turndown(contentRef.current.innerHTML)); setIsMdMode(true); showToast('已切换为 Markdown 源码模式', 'info');
                            } else {
                                contentRef.current.innerHTML = marked.parse(mdContent); setIsMdMode(false); handleInput(false, true); showToast('已返回富文本渲染模式', 'success');
                            }
                        }} className={`w-8 h-8 flex items-center justify-center transition-all ${isMdMode ? 'text-indigo-500 bg-indigo-50 rounded-lg' : 'text-gray-400 hover:text-indigo-400'}`} title="Markdown 编辑模式"><i className="fab fa-markdown text-lg"></i></button>
                        <button onClick={()=>{setStudyMode(!studyMode); if(!studyMode)contentRef.current.querySelectorAll('.revealed').forEach(el=>el.classList.remove('revealed'));}} className={`ml-1 w-8 h-8 md:w-auto md:h-auto md:px-3 md:py-1 rounded-full md:rounded-full flex items-center justify-center text-[11px] font-bold transition shrink-0 ${studyMode?'bg-indigo-500 text-white':'bg-gray-100 text-gray-500'}`}>
                            <i className={`fas ${studyMode ? 'fa-person-walking-arrow-right' : 'fa-book-open'} md:hidden text-xs`}></i>
                            <span className="hidden md:inline">{studyMode?'退出':'背诵'}</span>
                        </button>
                    </div>
                </div>

                {!studyMode && (
                    <div className="flex items-center gap-2 overflow-x-auto w-full px-2 h-10 bg-white shadow-inner" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
                        <button onClick={() => {
                            saveSelection();
                            setModal({ type: 'ai', title: '🪄 导入 AI 内容', onConfirm: (md, mode) => {
                                const html = marked.parse(md.replace(/\n/g, '  \n')); const editor = contentRef.current;
                                if (mode === 'insert') { if (!restoreSelection()) { editor.focus(); showToast('光标位置丢失，已转为追加', 'warning'); editor.insertAdjacentHTML('beforeend', `<br class="clear-format" /><div class="ai-block">${html}</div>`); editor.scrollTop = editor.scrollHeight; } else { document.execCommand('insertHTML', false, html); showToast('已插入光标位置', 'success'); } } else { window.getSelection().removeAllRanges(); editor.insertAdjacentHTML('beforeend', `<br class="clear-format" /><div class="ai-block">${html}</div>`); editor.scrollTop = editor.scrollHeight; showToast('已追加到笔记末尾', 'success'); }
                                handleInput(false, true); if (window.renderMathInElement) window.renderMathInElement(editor, { delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}], throwOnError: false });
                            }})
                        }} className="px-2 py-1 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded text-[10px] font-bold shrink-0">AI</button>
                        
                        <div className="relative shrink-0 flex items-center bg-gray-50 rounded-lg px-2 h-7 border border-gray-200">
                            <i className="fas fa-text-height text-[10px] text-gray-400 mr-1"></i>
                            <select className="bg-transparent text-[11px] font-bold text-gray-600 outline-none w-10 appearance-none" onChange={(e) => { applyFontSize(e.target.value); e.target.value = 'default'; }}>
                                <option value="default">字号</option><option value="12px">12</option><option value="13px">13</option><option value="14px">14</option><option value="15px">15</option><option value="16px">16(正)</option><option value="18px">18</option><option value="20px">20</option><option value="24px">24</option><option value="36px">36</option>
                            </select>
                        </div>

                        <div className="relative shrink-0 ml-2">
                            <button onMouseDown={(e) => e.preventDefault()} onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setColorMenuPos({ x: rect.left, y: rect.bottom }); saveSelection(); setShowColorMenu(!showColorMenu); }} className={`w-7 h-7 flex flex-col items-center justify-center bg-gray-50 hover:bg-white border border-gray-200 rounded-lg transition ${showColorMenu ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-100' : ''}`} title="字体颜色">
                                <span className="font-serif font-bold text-gray-700 text-[11px] leading-none mt-0.5">A</span>
                                <div className="w-4 h-1 bg-gradient-to-r from-red-400 via-yellow-400 to-blue-400 rounded-full mt-0.5"></div>
                            </button>
                            {showColorMenu && (
                                <>
                                    <div className="fixed inset-0 z-[9998]" onClick={() => setShowColorMenu(false)}></div>
                                    <div className="fixed bg-white rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.2)] border border-gray-100 p-3 z-[9999] animate-in slide-in-from-top-2 fade-in duration-200 w-36" style={{ left: Math.min(window.innerWidth - 150, colorMenuPos.x), top: colorMenuPos.y + 8 }}>
                                        <div className="text-[10px] font-bold text-gray-400 mb-2 px-1 flex justify-between"><span>文字颜色</span><span className="text-[9px] bg-gray-100 px-1 rounded text-gray-500">Color</span></div>
                                        <div className="grid grid-cols-4 gap-2 mb-3">{TEXT_COLORS.map((c) => (<button key={c.hex} onMouseDown={(e) => e.preventDefault()} onClick={() => { applyTextColor(c.hex); setShowColorMenu(false); }} className="w-6 h-6 rounded-full border border-black/5 hover:scale-125 transition-transform shadow-sm flex items-center justify-center group relative" style={{ backgroundColor: c.hex }} title={c.name}></button>))}</div>
                                        <div className="w-full h-px bg-gray-100 my-2"></div>
                                        <div className="relative group">
                                            <input type="color" ref={colorInputRef} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10" onChange={(e) => applyTextColor(e.target.value)} onClick={(e) => e.stopPropagation()} />
                                            <button className="w-full py-1.5 flex items-center justify-center gap-2 bg-gradient-to-r from-gray-50 to-gray-100 group-hover:from-indigo-50 group-hover:to-pink-50 rounded-lg text-[10px] font-bold text-gray-600 group-hover:text-indigo-600 transition border border-gray-200 group-hover:border-indigo-200"><i className="fas fa-palette"></i>自定义</button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex items-center bg-gray-50 rounded-lg px-1 h-7 border border-gray-200 mx-2 shrink-0">
                            <button onClick={() => handleAppZoom(-0.1)} className="w-6 h-full flex items-center justify-center text-gray-500 hover:text-indigo-500 hover:bg-white rounded transition active:scale-90" title="缩小界面"><i className="fas fa-magnifying-glass-minus text-[10px]"></i></button>
                            <div className="relative w-8 h-full flex items-center justify-center group">
                                <input className="w-full h-full bg-transparent text-[9px] font-bold text-gray-400 group-hover:text-indigo-500 text-center font-mono leading-none outline-none p-0" value={zoomInput} onChange={(e) => setZoomInput(e.target.value)} onBlur={handleZoomCommit} onKeyDown={(e) => e.key === 'Enter' && handleZoomCommit()} onFocus={(e) => e.target.select()} onDoubleClick={() => { setAppZoom(1); showToast('已重置为 100%', 'success'); }} title="输入数字回车，或双击重置" />
                                <span className="absolute right-0 pointer-events-none text-[8px] text-gray-300 opacity-0 group-hover:opacity-100 transition scale-75">%</span>
                            </div>
                            <button onClick={() => handleAppZoom(0.1)} className="w-6 h-full flex items-center justify-center text-gray-500 hover:text-indigo-500 hover:bg-white rounded transition active:scale-90" title="放大界面"><i className="fas fa-magnifying-glass-plus text-[10px]"></i></button>
                        </div>

                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                        <button onClick={() => fileInputRef.current.click()} className="px-2 py-1 bg-indigo-50 text-indigo-500 rounded text-[10px] font-bold shrink-0 mr-2 flex items-center gap-1"><i className="fas fa-image"></i> 图片</button>
                        
                        <div className="flex items-center border-r pr-2 gap-1.5 shrink-0">
                            {COLORS.map(c => <button key={c.cls} onClick={() => applyTag(c.cls)} className={`w-4 h-4 rounded-full ${c.bg} border border-gray-100 shadow-sm mb-0.5`}></button>)}
                            <button onClick={() => applyTag('recite-point')} className="text-blue-500 w-6 h-6 flex items-center justify-center"><i className="fas fa-eye-slash text-xs"></i></button>
                            <button onClick={() => applyTag('hl-shadow')} className="text-rose-400 w-6 h-6 flex items-center justify-center"><i className="fas fa-wand-magic-sparkles text-xs"></i></button>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 border-r pr-2">
                            <Btn text="H1" onClick={()=>applyHeading('H1')} />
                            <Btn text="H2" onClick={()=>applyHeading('H2')} />
                            <Btn text="H3" onClick={()=>applyHeading('H3')} />
                            <Btn text="正文" onClick={() => {
                                const sel = window.getSelection();
                                if (sel.rangeCount > 0) {
                                    const range = sel.getRangeAt(0); let block = range.commonAncestorContainer;
                                    while (block && block.nodeType === 3) block = block.parentNode;
                                    while (block && !['P','DIV','H1','H2','H3','LI','BLOCKQUOTE'].includes(block.nodeName) && block !== contentRef.current) { block = block.parentNode; }
                                    if(block && block !== contentRef.current) { const newRange = document.createRange(); newRange.selectNodeContents(block); sel.removeAllRanges(); sel.addRange(newRange); }
                                }
                                resetBlock(); sel.collapseToEnd(); showToast('格式已复原', 'success');
                            }} />
                            <div className="flex bg-gray-100 rounded-lg p-0.5 mx-1">
                                <button onClick={()=>format('justifyLeft')} className="w-7 h-7 flex items-center justify-center rounded hover:bg-white hover:shadow-sm text-gray-500 transition"><i className="fas fa-align-left text-[10px]"></i></button>
                                <button onClick={()=>format('justifyCenter')} className="w-7 h-7 flex items-center justify-center rounded hover:bg-white hover:shadow-sm text-gray-500 transition"><i className="fas fa-align-center text-[10px]"></i></button>
                                <button onClick={()=>format('justifyRight')} className="w-7 h-7 flex items-center justify-center rounded hover:bg-white hover:shadow-sm text-gray-500 transition"><i className="fas fa-align-right text-[10px]"></i></button>
                            </div>
                            <button onClick={()=>setModal({type:'symbol', onConfirm:(c)=>format('insertText',c)})} className="w-6 h-6 text-gray-400 flex items-center justify-center hover:text-indigo-500 transition"><i className="fas fa-icons text-xs"></i></button>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                            <Btn icon="fa-plus-square" color="text-indigo-500" onClick={()=>{
                                const sel = window.getSelection().toString();
                                setModal({type:'card', title: '制作卡片', defaultVal1: sel, defaultVal3: notebook.name, existingCategories: allCategories, onConfirm:(f,b,c)=>{ onAddCard(f,b,c); showToast('已存入卡片盒', 'success'); }});
                            }} />
                            <Btn icon="fa-language" color="text-blue-500" onClick={() => {
                                const sel = window.getSelection().toString().trim();
                                if (sel) { window.triggerDict(sel); } else { showToast('请先划选单词', 'warning'); }
                            }} />
                            <Btn icon="fa-link" color="text-sky-500" title="插入引用链接" onClick={() => {
                                saveSelection();
                                window.triggerSearch({ type: 'global', onPick: (item) => {
                                    const restored = restoreSelection(); if (!restored) contentRef.current.focus();
                                    let anchorText = ''; let displayText = item.title;
                                    if (item.matchType === '正文') { anchorText = item.snippet.replace(/\.\.\./g, '').trim(); displayText += ` (引用: ${anchorText.substring(0, 5)}...)`; }
                                    const linkHtml = `<span class="internal-link mx-1" style="color: #0284c7; text-decoration: underline; cursor: pointer; font-weight: bold; font-size: 0.9em;" data-nb="${item.nbId}" data-pg="${item.pgId}" data-anchor="${anchorText ? encodeURIComponent(anchorText) : ''}" contenteditable="false">🔗${displayText}</span>&nbsp;`;
                                    document.execCommand('insertHTML', false, linkHtml); handleInput(false, true); showToast(anchorText ? '已插入精准锚点链接' : '已插入页面链接', 'success');
                                }});
                            }} />
                            <Btn icon="fa-file-pdf" color="text-rose-400" onClick={() => onPrintClick(notebook, page.id)} />
                        </div>
                    </div>
                )}
            </header>

            {showReplaceBar && (
                <div className="fixed md:absolute z-[60] bottom-0 left-0 right-0 md:bottom-auto md:top-20 md:right-6 md:left-auto md:w-80 bg-white md:rounded-2xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.2)] md:shadow-2xl border-t md:border border-gray-100 overflow-hidden animate-in slide-in-from-bottom md:slide-in-from-right duration-300">
                    <div className="flex bg-gray-50 border-b">
                        <button onClick={() => setReplaceMode(false)} className={`flex-1 py-3 text-xs font-bold transition ${!replaceMode ? 'bg-white text-amber-600 border-b-2 border-amber-500' : 'text-gray-400 hover:text-gray-600'}`}>查找</button>
                        <button onClick={() => setReplaceMode(true)} className={`flex-1 py-3 text-xs font-bold transition ${replaceMode ? 'bg-white text-emerald-600 border-b-2 border-emerald-500' : 'text-gray-400 hover:text-gray-600'}`}>替换</button>
                        <button onClick={() => setShowReplaceBar(false)} className="px-4 text-gray-300 hover:text-gray-500"><i className="fas fa-times"></i></button>
                    </div>

                    <div className="p-5 space-y-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">查找内容</label>
                            <div className="flex items-center bg-gray-50 border border-transparent focus-within:border-amber-200 focus-within:bg-white rounded-xl px-3 py-2 transition">
                                <input className="bg-transparent outline-none text-sm w-full text-gray-600" placeholder="输入关键字..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (replaceMode) handleReplace(); else executeFind(searchQuery); } }} />
                                <i className="fas fa-search text-gray-300 text-xs ml-2"></i>
                            </div>
                        </div>

                        {replaceMode && (
                            <div className="space-y-1 animate-in fade-in zoom-in duration-200">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">替换为</label>
                                <div className="flex items-center bg-gray-50 border border-transparent focus-within:border-emerald-200 focus-within:bg-white rounded-xl px-3 py-2 transition">
                                    <input className="bg-transparent outline-none text-sm w-full text-gray-600" placeholder="输入新内容..." value={replaceQuery} onChange={e => setReplaceQuery(e.target.value)} />
                                    <i className="fas fa-pen text-gray-300 text-xs ml-2"></i>
                                </div>
                            </div>
                        )}

                        <div className="pt-2">
                            {!replaceMode ? (
                                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => executeFind(searchQuery)} className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-amber-100 transition">查找下一个 (Enter)</button>
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={handleReplace} className="py-3 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-100 transition">替换当前 (Enter)</button>
                                    <button onClick={handleReplaceAll} className="py-3 bg-gray-800 hover:bg-black text-white text-xs font-bold rounded-xl shadow-lg shadow-gray-200 transition">全部替换</button>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="bg-gray-50 px-5 py-2 text-center">
                        <p className="text-[9px] text-gray-400 tracking-tighter">{replaceMode ? "模式：查找并替换" : "模式：仅查找"}</p>
                    </div>
                </div>
            )}

            <div className="flex-1 flex overflow-hidden relative">
                {showSidebar && <div className="fixed inset-0 bg-black/20 z-30 md:hidden" onClick={() => setShowSidebar(false)}></div>}
                
                <div className={`absolute md:relative z-40 h-full bg-white border-r transition-all duration-300 ease-in-out flex flex-col shadow-xl md:shadow-none overflow-hidden ${showSidebar ? 'w-64 translate-x-0 opacity-100' : 'w-0 -translate-x-full opacity-0 invisible'}`}>
                    <div className="p-4 border-b flex items-center justify-between bg-gray-50/50">
                        <div className="flex bg-gray-100 p-1 rounded-xl w-full mr-2">
                            <button onClick={() => setSidebarMode('toc')} className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition ${sidebarMode === 'toc' ? 'bg-white shadow-sm ' + themeColor.text : 'text-gray-400'}`}>章节</button>
                            <button onClick={() => setSidebarMode('outline')} className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition ${sidebarMode === 'outline' ? 'bg-white shadow-sm ' + themeColor.text : 'text-gray-400'}`}>大纲</button>
                            <button onClick={() => setSidebarMode('notes')} className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition ${sidebarMode === 'notes' ? 'bg-white shadow-sm ' + themeColor.text : 'text-gray-400'}`}>批注</button>
                        </div>
                        <button onClick={() => setShowSidebar(false)} className="text-gray-400 hover:text-gray-600 md:hidden ml-2"><i className="fas fa-times"></i></button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {sidebarMode === 'toc' && (
                            <div className="flex flex-col h-full">
                                <div className="p-2 pb-0">
                                    <button onClick={() => setModal({ type: 'input', title: '新建章节', onConfirm: (t) => onCreatePage(t) })} className="w-full py-2 border-2 border-dashed border-indigo-200 text-indigo-400 rounded-xl font-bold text-xs hover:bg-indigo-50 hover:border-indigo-300 transition flex items-center justify-center gap-2">
                                        <i className="fas fa-plus"></i> 新建章节
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                                    {notebook.pages.map((pg, idx) => (
                                        <button key={pg.id} onClick={() => { onSwitchPage(pg.id); if(window.innerWidth < 768) setShowSidebar(false); }} className={`w-full text-left p-3 rounded-xl text-xs transition flex items-center gap-3 group ${pg.id === page.id ? themeColor.bg + ' ' + themeColor.text + ' font-bold shadow-sm' : 'hover:bg-gray-50 text-gray-500'}`}>
                                            <span className={`text-[10px] italic ${pg.id === page.id ? 'opacity-100' : 'opacity-30'}`}>{idx + 1}</span>
                                            <span className="truncate">{pg.title}</span>
                                        </button>
                                    ))}
                                    <div className="h-10"></div>
                                </div>
                            </div>
                        )}
                        
                        {sidebarMode === 'outline' && (
                            <div className="space-y-1">
                                <div className="flex flex-col">
                                    <div className="px-2 pb-3 flex justify-end">
                                        <button onClick={() => setIsOutlineEditMode(!isOutlineEditMode)} className={`px-3 py-1.5 rounded-xl flex items-center gap-2 transition-all shadow-sm ${isOutlineEditMode ? 'bg-rose-500 text-white' : 'bg-white border border-gray-100 text-indigo-500 hover:bg-indigo-50'}`}>
                                            <i className={`fas ${isOutlineEditMode ? 'fa-check-circle' : 'fa-pen-to-square'} text-[10px]`}></i>
                                            <span className="text-[10px] font-bold">{isOutlineEditMode ? '保存修改' : '编辑大纲'}</span>
                                        </button>
                                    </div>
                                    {extractOutline().filter(item => item.isVisible).length > 0 ? extractOutline().filter(item => item.isVisible).map((item, idx) => (
                                        <div key={item.id} className="group relative flex items-center">
                                            {['H1', 'H2'].includes(item.tag) && (
                                                <div className="absolute w-8 h-full z-10 flex items-center justify-center cursor-pointer transition-all" style={{ left: item.tag === 'H1' ? '0' : '1.5rem' }} onClick={(e) => { e.stopPropagation(); const newSet = new Set(sidebarFoldedIds); if (newSet.has(item.id)) newSet.delete(item.id); else newSet.add(item.id); setSidebarFoldedIds(newSet); }}>
                                                    <i className={`fas fa-caret-down text-[10px] transition-transform duration-200 ${item.collapsed ? '-rotate-90 text-indigo-300' : 'text-indigo-500'}`}></i>
                                                </div>
                                            )}
                                            <button onClick={() => { if (isOutlineEditMode) return; item.el.scrollIntoView({ behavior: 'smooth', block: 'center' }); item.el.classList.add('search-target-highlight'); setTimeout(() => item.el.classList.remove('search-target-highlight'), 2000); if(window.innerWidth < 768) setShowSidebar(false); }} className={`w-full text-left py-2 px-3 pl-8 pr-4 rounded-lg text-xs hover:bg-indigo-50 hover:text-indigo-600 transition flex items-center ${item.tag === 'H1' ? 'font-bold text-gray-700' : 'text-gray-500'}`} style={{ marginLeft: item.tag === 'H1' ? '0' : item.tag === 'H2' ? '1.5rem' : '2.8rem', borderLeft: item.tag === 'H1' ? '3px solid #e0e7ff' : 'none' }}>
                                                {isOutlineEditMode ? (
                                                    <input className="flex-1 bg-white/50 border-b border-indigo-200 outline-none text-gray-700 px-1 focus:bg-white transition-all" value={item.text} autoFocus onClick={(e) => e.stopPropagation()} onChange={(e) => { const newText = e.target.value; item.el.innerText = newText; handleInput(false, true); }} />
                                                ) : (
                                                    <span className="truncate flex-1">{item.text}</span>
                                                )}
                                            </button>
                                        </div>
                                    )) : (
                                        <div className="py-10 text-center text-gray-300 text-xs"><p>还没有标题哦</p><p className="scale-75 mt-1 opacity-50">选中文字点击 H1/H2/H3 即可生成</p></div>
                                    )}
                                </div>
                            </div>
                        )}

                        {sidebarMode === 'notes' && (
                            extractNotes().map((n, idx) => (
                                <div key={idx} onClick={() => { const els=contentRef.current.querySelectorAll('.note-link'); if(els[idx]) els[idx].scrollIntoView({behavior:'smooth', block:'center'}); }} className="w-full text-left p-4 rounded-2xl bg-gray-50 border border-transparent hover:border-rose-200 transition cursor-pointer group mb-2">
                                    <div className="flex items-center gap-2 mb-2"><span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span><span className="text-[10px] font-bold text-gray-400 truncate flex-1">{n.original}</span></div>
                                    <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">{n.note}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className={`flex-1 overflow-y-auto custom-scrollbar flex justify-center transition-all relative ${studyMode?'study-active':''}`} onClick={(e) => {
                    handleFoldClick(e);
                    if (e.target.closest('.note-popup')) return;
                    if (e.target.tagName === 'IMG') { setActiveImg(e.target); e.target.classList.add('img-active'); setSelPop(null); setActiveNote(null); return; } else { if (activeImg) { activeImg.classList.remove('img-active'); setActiveImg(null); } }
                    if(studyMode) { const target = e.target.closest('.recite-point'); if(target) { target.classList.toggle('revealed'); return; } }
                    
                    const linkTarget = e.target.closest('.internal-link');
                    if (linkTarget) {
                        const attrNb = linkTarget.getAttribute('data-nb');
                        const attrPg = linkTarget.getAttribute('data-pg');
                        const attrAnchor = linkTarget.getAttribute('data-anchor');
                        e.preventDefault(); e.stopPropagation();
                        const nbId = /^\d+$/.test(attrNb) ? Number(attrNb) : attrNb;
                        const pgId = /^\d+$/.test(attrPg) ? Number(attrPg) : attrPg;
                        if (nbId && pgId) {
                            const anchorText = attrAnchor ? decodeURIComponent(attrAnchor) : null;
                            if (window.triggerReference) { window.triggerReference(nbId, pgId, anchorText); } else { window.dispatchEvent(new CustomEvent('JUMP_TO_NOTE', { detail: { nbId, pgId } })); }
                            return;
                        }
                    }

                    if (!studyMode) {
                        const formatTarget = e.target.closest('.hl-pink, .hl-green, .hl-blue, .hl-purple, .hl-yellow, .hl-shadow, .recite-point');
                        if (formatTarget) { setActiveRemover({ x: e.clientX, y: e.clientY, target: formatTarget }); setActiveNote(null); return; } else { setActiveRemover(null); }
                    }

                    const noteTarget = e.target.closest('.note-link');
                    if (noteTarget) {
                        setTimeout(() => { setNoteOffset({ x: 0, y: 0 }); setActiveNote({ text: noteTarget.getAttribute('data-note'), x: e.clientX, y: e.clientY, target: noteTarget }); }, 10);
                    } else {
                        setActiveNote(null);
                    }
                }}>
                    
                    {activeNote && (
                        <div className="fixed z-[99] note-popup bg-white dark:bg-zinc-800 border dark:border-zinc-700 p-4 rounded-2xl w-64 shadow-2xl cursor-default" style={{ left: Math.min(window.innerWidth - 280, activeNote.x) + noteOffset.x, top: Math.min(window.innerHeight - 200, activeNote.y + 20) + noteOffset.y, touchAction: 'none' }} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => { if (e.target.closest('button')) return; setIsDraggingNote(true); dragStartPos.current = { x: e.clientX - noteOffset.x, y: e.clientY - noteOffset.y }; }} onMouseMove={(e) => { if (!isDraggingNote) return; setNoteOffset({ x: e.clientX - dragStartPos.current.x, y: e.clientY - dragStartPos.current.y }); }} onMouseUp={() => setIsDraggingNote(false)} onMouseLeave={() => setIsDraggingNote(false)}>
                            <div className="flex justify-between items-center mb-2 cursor-move bg-gray-50 dark:bg-zinc-700/50 -m-2 p-2 rounded-t-xl mb-2">
                                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest flex items-center gap-2">📌 批注</span>
                                <div className="flex gap-2">
                                    <button onClick={() => { const currentText = activeNote.text; const currentTarget = activeNote.target; setActiveNote(null); setModal({ type: 'input', title: '修改批注', defaultVal1: currentText, onConfirm: (newText) => { if (newText !== null) { currentTarget.setAttribute('data-note', newText); handleInput(false, true); showToast('批注已更新', 'success'); } } }); }} className="w-6 h-6 flex items-center justify-center rounded hover:bg-white text-gray-400 hover:text-indigo-500 transition" title="修改"><i className="fas fa-pen text-[10px]"></i></button>
                                    <button onClick={() => removeNote(activeNote.target)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-white text-gray-400 hover:text-rose-500 transition" title="删除批注"><i className="fas fa-trash-can text-[10px]"></i></button>
                                </div>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap select-none">{activeNote.text}</p>
                        </div>
                    )}

                    {activeRemover && (
                        <div className="fixed z-[101] remover-popup" style={{ left: activeRemover.x - 10, top: activeRemover.y - 35 }}>
                            <button className="remover-btn shadow-lg" onClick={(e) => { e.stopPropagation(); const el = activeRemover.target; const parent = el.parentNode; while (el.firstChild) { parent.insertBefore(el.firstChild, el); } parent.removeChild(el); handleInput(); setActiveRemover(null); showToast('格式已移除', 'info'); }}>
                                <i className="fas fa-trash-can"></i>
                            </button>
                        </div>
                    )}

                    <div className="w-full max-w-3xl pt-8 md:pt-12 px-4 md:px-10 transition-transform origin-top duration-200 ease-out" style={{ paddingBottom: '65vh', zoom: appZoom }}>
                        <textarea className={`w-full flex-1 bg-gray-50/50 text-gray-700 font-mono text-sm leading-relaxed p-6 outline-none resize-none custom-scrollbar rounded-xl border border-gray-100 shadow-inner ${isMdMode ? 'block' : 'hidden'}`} value={mdContent} onChange={(e) => setMdContent(e.target.value)} placeholder="在这里编写 Markdown 源码..." style={{ minHeight: '60vh' }} />
                        
                        <div ref={contentRef} className={`editor-core editor-wrapper ${isMdMode ? 'hidden' : 'block'}`} contentEditable={!studyMode} onPaste={handlePaste} onInput={() => handleInput(false, false)} onBlur={saveSelection} spellCheck="false" onMouseUp={(e) => { saveSelection(); const sel = window.getSelection().toString().trim(); if (sel && !studyMode) { setSelPop({ x: e.clientX, y: e.clientY, text: sel }); } else { setSelPop(null); } }} onKeyUp={saveSelection}></div>
                        
                        <div style={{ height: '30vh', width: '100%' }}></div>

                        {selPop && !studyMode && (
                            <div className="fixed z-[110] animate-in fade-in zoom-in duration-150 flex items-center bg-white/80 backdrop-blur-md rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/50 p-1" style={{ left: selPop.x - 25, top: selPop.y - 55 }}>
                                <button onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); setBrowserUrl('https://cjjc.weblio.jp/content/' + encodeURIComponent(selPop.text)); setSelPop(null); }} className="w-8 h-8 flex items-center justify-center rounded-lg text-[#ff4757] hover:bg-[#ff4757] hover:text-white transition-all active:scale-90" title="Weblio 日中翻译"><span className="text-[11px] font-black">日</span></button>
                                <div className="w-[1px] h-4 bg-gray-200 mx-1"></div>
                                <button onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); window.triggerDict(selPop.text, selPop.x, selPop.y); setSelPop(null); }} className="w-8 h-8 flex items-center justify-center rounded-lg text-[#3742fa] hover:bg-[#3742fa] hover:text-white transition-all active:scale-90" title="本地英语词库"><span className="text-[11px] font-black">英</span></button>
                                <div className="w-[1px] h-4 bg-gray-200 mx-1"></div>
                                <button onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); const sel = window.getSelection(); if(!sel.rangeCount) return; const range = sel.getRangeAt(0).cloneRange(); setSelPop(null); setModal({type:'input', title:'添加批注', onConfirm:(text)=>{ if(!text)return; const fragment = range.extractContents(); const wrapTextNodes = (domNode) => { if (domNode.nodeType === 3) { if (!domNode.textContent.trim()) return domNode; const span = document.createElement('span'); span.className = 'note-link'; span.setAttribute('data-note', text); span.textContent = domNode.textContent; return span; } else if (domNode.nodeType === 1) { const children = Array.from(domNode.childNodes); children.forEach(child => { const newChild = wrapTextNodes(child); if (newChild !== child) domNode.replaceChild(newChild, child); }); return domNode; } return domNode; }; Array.from(fragment.childNodes).forEach(node => { const newNode = wrapTextNodes(node); if (newNode !== node) fragment.replaceChild(newNode, node); }); range.insertNode(fragment); handleInput(false, true); showToast('已添加', 'success'); }}); }} className="w-8 h-8 flex items-center justify-center rounded-lg text-fuchsia-500 hover:bg-fuchsia-500 hover:text-white transition-all active:scale-90" title="添加批注"><span className="text-[11px] font-black">注</span></button>
                            </div>
                        )}
                    </div>
                </div>

                {activeImg && !studyMode && (
                    <div className="fixed z-[120] bg-white rounded-xl shadow-2xl border border-gray-100 p-2 flex gap-2 animate-in zoom-in-95 duration-150" style={{ left: '50%', bottom: '100px', transform: 'translateX(-50%)' }} onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => { activeImg.className = ''; handleInput(false, true); setActiveImg(null); }} className="p-2 hover:bg-gray-100 rounded-lg text-xs flex flex-col items-center gap-1 text-gray-500"><i className="fas fa-align-justify text-lg"></i><span>独占</span></button>
                        <button onClick={() => { activeImg.className = 'layout-left'; handleInput(false, true); setActiveImg(null); }} className="p-2 hover:bg-gray-100 rounded-lg text-xs flex flex-col items-center gap-1 text-gray-500"><i className="fas fa-indent text-lg"></i><span>左环绕</span></button>
                        <button onClick={() => { activeImg.className = 'layout-right'; handleInput(false, true); setActiveImg(null); }} className="p-2 hover:bg-gray-100 rounded-lg text-xs flex flex-col items-center gap-1 text-gray-500"><i className="fas fa-outdent text-lg"></i><span>右环绕</span></button>
                        <div className="w-px bg-gray-200 mx-1"></div>
                        <button onClick={() => { activeImg.remove(); handleInput(false, true); setActiveImg(null); }} className="p-2 hover:bg-rose-50 rounded-lg text-xs flex flex-col items-center gap-1 text-rose-500"><i className="fas fa-trash-can text-lg"></i><span>删除</span></button>
                    </div>
                )}

                {browserUrl && (
                    <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-[1px]" onMouseDown={() => setBrowserUrl(null)}>
                        <div className="bg-white w-full md:w-[450px] h-[80%] md:h-[650px] rounded-t-[2.5rem] md:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200" onMouseDown={e => e.stopPropagation()}>
                            <div className="w-full flex flex-col items-center pt-3 pb-1 bg-gray-50/80 shrink-0">
                                <div className="w-12 h-1.5 bg-gray-300 rounded-full mb-2 md:hidden"></div>
                                <div className="w-full flex items-center justify-between px-6 py-1">
                                    <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Quick Dictionary</span>
                                    <button onMouseDown={(e) => { e.stopPropagation(); window.open(browserUrl, '_blank'); }} className="mr-2 w-8 h-8 flex items-center justify-center bg-indigo-50 text-indigo-500 rounded-full active:bg-indigo-500 active:text-white transition-all" title="在浏览器中打开"><i className="fas fa-external-link-alt text-xs"></i></button>
                                    <button onMouseDown={(e) => { e.stopPropagation(); setBrowserUrl(null); }} className="w-8 h-8 flex items-center justify-center bg-gray-200/60 text-gray-500 rounded-full active:bg-rose-500 active:text-white transition-all"><i className="fas fa-times text-sm"></i></button>
                                </div>
                            </div>
                            <div className="flex-1 w-full bg-white relative">
                                <iframe src={browserUrl} className="w-full h-full border-none" sandbox="allow-same-origin allow-forms allow-popups" loading="lazy"></iframe>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/* 🌸 中文注释：增强版卡片盒组件 */
function CardBoxView({ cards, setData, fullData, setModal, onMoveToTrash, showToast }) {
    const [viewMode, setViewMode] = useState('decks'); 
    const [activeCategory, setActiveCategory] = useState(null);
    const [studyIndex, setStudyIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]); 
    const [detailCard, setDetailCard] = useState(null); 
    const [showStudySidebar, setShowStudySidebar] = useState(false); 
    const [isSelectMode, setIsSelectMode] = useState(false);

    const toggleSelectAll = (filteredCards) => {
        if (selectedIds.length === filteredCards.length) setSelectedIds([]);
        else setSelectedIds(filteredCards.map(c => c.id));
    };
    
    const categoryMap = cards.reduce((acc, curr) => {
        const cat = curr.category || '默认';
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
    }, {});
    const categoryList = Object.keys(categoryMap);
    const filteredCards = activeCategory ? cards.filter(c => (c.category || '默认') === activeCategory) : [];

    const handleBatchDelete = () => {
        const selectedCards = cards.filter(c => selectedIds.includes(c.id));
        const newTrash = selectedCards.map(c => ({ trashId: Date.now() + Math.random(), type: 'card', data: c, deletedAt: new Date().toLocaleString() + " (批量删除)" }));
        setData({ ...fullData, cards: cards.filter(c => !selectedIds.includes(c.id)), trash: [...newTrash, ...fullData.trash] });
        setSelectedIds([]);
        showToast(`已移至回收站`);
    };

    const handleBatchAction = (actionType, targetCategory) => {
        if (actionType === 'move') {
            setData({ ...fullData, cards: cards.map(c => selectedIds.includes(c.id) ? { ...c, category: targetCategory } : c) });
        } else {
            const copies = cards.filter(c => selectedIds.includes(c.id)).map(c => ({ ...c, id: Date.now() + Math.random(), category: targetCategory }));
            setData({ ...fullData, cards: [...copies, ...cards] });
        }
        setSelectedIds([]);
        showToast('操作成功');
    };

    const updateCategory = (oldName, newName, colorIdx) => {
        const newStyles = { ...fullData.deckStyles, [newName]: colorIdx };
        setData({ ...fullData, cards: cards.map(c => (c.category || '默认') === oldName ? { ...c, category: newName } : c), deckStyles: newStyles });
        if (activeCategory === oldName) setActiveCategory(newName);
    };

    if (viewMode === 'study') {
        const currentCard = filteredCards[studyIndex];
        if (!currentCard) return <div className="flex-1 flex items-center justify-center">没有卡片了</div>;
        return (
            <div className="flex-1 flex overflow-hidden bg-slate-50 relative">
                {showStudySidebar && (
                    <div className="absolute md:relative inset-0 md:inset-auto md:w-64 bg-white border-r flex flex-col z-20 shadow-xl">
                        <div className="p-4 border-b flex justify-between items-center bg-indigo-50/50">
                            <span className="font-bold text-xs text-indigo-600">卡片目录</span>
                            <button onClick={() => setShowStudySidebar(false)} className="text-gray-400 hover:text-gray-600"><i className="fas fa-times"></i></button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                            {filteredCards.map((c, i) => (
                                <button key={c.id} onClick={() => { setStudyIndex(i); setIsFlipped(false); setShowStudySidebar(false); }} className={`w-full text-left p-3 rounded-xl text-xs transition ${studyIndex === i ? 'bg-indigo-500 text-white shadow-md' : 'hover:bg-gray-100 text-gray-600'}`}>
                                    <div className="font-bold truncate">{c.front}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative">
                    <div className="absolute top-4 md:top-6 left-4 md:left-6 flex gap-3">
                        <button onClick={() => setViewMode('list')} className="text-gray-400 hover:text-gray-600 font-bold"><i className="fas fa-times mr-2"></i>退出</button>
                        <button onClick={() => setShowStudySidebar(!showStudySidebar)} className={`px-3 py-1 rounded-lg text-xs font-bold transition ${showStudySidebar ? 'bg-indigo-500 text-white' : 'bg-white text-indigo-500 border'}`}><i className="fas fa-list-ul mr-2"></i>列表</button>
                    </div>
                    
                    <div className="text-[10px] font-bold text-gray-400 mb-6 tracking-widest uppercase mt-10 md:mt-0">{activeCategory} · {studyIndex + 1} / {filteredCards.length}</div>
                    <div className="anki-container w-full max-w-[90vw] md:max-w-lg aspect-[4/3]" onClick={() => setIsFlipped(!isFlipped)}>
                        <div className={`anki-card ${isFlipped ? 'is-flipped' : ''}`}>
                            <div className="anki-face anki-front">
                                <div className="text-indigo-300 text-[10px] font-bold mb-4 tracking-widest uppercase">Question</div>
                                <div className="flex-grow flex items-center justify-center w-full px-4 text-xl md:text-2xl font-bold leading-snug overflow-y-auto">{currentCard.front}</div>
                                <div className="mt-4 text-gray-300 text-[8px] font-bold tracking-widest">点击翻面</div>
                                <button onClick={(e) => { e.stopPropagation(); const cardToEdit = currentCard; setDetailCard(null); setModal({ type: 'card', title: '编辑卡片', defaultVal1: cardToEdit.front, defaultVal2: cardToEdit.back, defaultVal3: cardToEdit.category || '默认', existingCategories: categoryList, onConfirm: (f, b, c) => { setData({ ...fullData, cards: cards.map(card => card.id === cardToEdit.id ? { ...card, front: f, back: b, category: c } : card) }); showToast('已更新'); } }); }} className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center bg-gray-50 hover:bg-indigo-500 text-gray-400 hover:text-white rounded-full transition-all"><i className="fas fa-pen text-[9px]"></i></button>
                            </div>
                            <div className="anki-face anki-back">
                                <div className="text-indigo-600 text-[10px] font-bold mb-4 uppercase tracking-widest">Answer</div>
                                <div className="flex-grow flex items-center justify-center w-full px-4 overflow-y-auto custom-scrollbar text-lg md:text-xl leading-relaxed text-gray-600">{currentCard.back}</div>
                                <div className="mt-4 text-indigo-200 text-[8px] font-bold tracking-widest">点击回转</div>
                                <button onClick={(e) => { e.stopPropagation(); const cardToEdit = currentCard; setDetailCard(null); setModal({ type: 'card', title: '编辑卡片', defaultVal1: cardToEdit.front, defaultVal2: cardToEdit.back, defaultVal3: cardToEdit.category || '默认', existingCategories: categoryList, onConfirm: (f, b, c) => { setData({ ...fullData, cards: cards.map(card => card.id === cardToEdit.id ? { ...card, front: f, back: b, category: c } : card) }); showToast('已更新'); } }); }} className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center bg-white/50 hover:bg-indigo-500 text-indigo-400 hover:text-white rounded-full transition-all"><i className="fas fa-pen text-[9px]"></i></button>
                            </div>
                        </div>
                    </div>
                    <div className="mt-6 md:mt-10 flex gap-4">
                        <button onClick={() => { setIsFlipped(false); setStudyIndex(Math.max(0, studyIndex - 1)) }} className="px-6 md:px-8 py-2.5 bg-white border rounded-full text-xs font-bold shadow-sm disabled:opacity-30" disabled={studyIndex===0}><i className="fas fa-arrow-left mr-2"></i>PREV</button>
                        <button onClick={() => { setIsFlipped(false); setStudyIndex(Math.min(filteredCards.length - 1, studyIndex + 1)) }} className="px-6 md:px-8 py-2.5 bg-indigo-500 text-white rounded-full text-xs font-bold shadow-lg shadow-indigo-100 disabled:opacity-30" disabled={studyIndex===filteredCards.length-1}>NEXT<i className="fas fa-arrow-right ml-2"></i></button>
                    </div>
                </div>
            </div>
        );
    }

    if (viewMode === 'list') {
        return (
            <div className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar flex flex-col items-center" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 35px)' }}>
                <div className="w-full max-w-5xl flex flex-col md:flex-row justify-between items-start md:items-end mb-6 md:mb-8 gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => {setViewMode('decks'); setSelectedIds([]);}} className="w-10 h-10 rounded-full hover:bg-gray-100 text-gray-400 flex items-center justify-center"><i className="fas fa-chevron-left"></i></button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">{activeCategory}</h1>
                            <p className="text-xs text-gray-400 mt-1">共有 {filteredCards.length} 张卡片 {selectedIds.length > 0 && `· 已选 ${selectedIds.length} 张`}</p>
                        </div>
                    </div>
                    <div className="flex gap-2 self-end md:self-auto overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
                        {isSelectMode ? (
                            <div className="flex bg-indigo-50 p-1.5 rounded-xl border border-indigo-100 gap-2 items-center whitespace-nowrap animate-in slide-in-from-top duration-300">
                                <button onClick={() => toggleSelectAll(filteredCards)} className="px-3 py-1.5 bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-2"><i className={`fas ${selectedIds.length === filteredCards.length ? 'fa-check-double' : 'fa-square'}`}></i>{selectedIds.length === filteredCards.length ? '取消全选' : '全选'}</button>
                                <div className="w-px h-4 bg-indigo-200 mx-1"></div>
                                {selectedIds.length > 0 ? (
                                    <>
                                        <button onClick={() => setModal({ type: 'batchAction', title: '移动到...', categories: categoryList, onConfirm: (cat) => handleBatchAction('move', cat) })} className="px-3 py-1.5 bg-white text-indigo-500 rounded-lg text-xs font-bold shadow-sm hover:bg-indigo-50 transition">移动</button>
                                        <button onClick={() => setModal({ type: 'batchAction', title: '复制到...', categories: categoryList, onConfirm: (cat) => handleBatchAction('copy', cat) })} className="px-3 py-1.5 bg-white text-indigo-500 rounded-lg text-xs font-bold shadow-sm hover:bg-indigo-50 transition">复制</button>
                                        <button onClick={handleBatchDelete} className="px-3 py-1.5 bg-rose-50 text-rose-500 rounded-lg text-xs font-bold hover:bg-rose-500 hover:text-white transition">删除 ({selectedIds.length})</button>
                                    </>
                                ) : (
                                    <span className="text-[10px] text-indigo-400 px-2">请先选择卡片</span>
                                )}
                                <button onClick={() => { setIsSelectMode(false); setSelectedIds([]); }} className="text-gray-400 px-2 hover:text-gray-600 transition"><i className="fas fa-times"></i></button>
                            </div>
                        ) : (
                            <div className="flex gap-2 shrink-0">
                                <button onClick={() => setIsSelectMode(true)} className="px-4 py-2 bg-white text-indigo-400 border border-indigo-100 rounded-lg text-sm font-bold hover:bg-indigo-50 transition">批量管理</button>
                                <button onClick={()=>setModal({type:'card', title:'在当前分类中新建', defaultVal3: activeCategory, existingCategories: categoryList, onConfirm:(f,b,c)=>setData({...fullData, cards:[{id:Date.now(), front:f, back:b, category: c}, ...cards]})})} className="px-4 py-2 bg-indigo-100 text-indigo-600 rounded-lg text-sm font-bold hover:bg-indigo-200 transition">新建卡片</button>
                                <button onClick={() => { setStudyIndex(0); setViewMode('study'); setIsFlipped(false); setShowStudySidebar(false); }} className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-bold shadow-lg">进入复习</button>
                            </div>
                        )}
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 w-full max-w-5xl padding-bottom-20">
                    {filteredCards.map((c) => {
                        const isSelected = selectedIds.includes(c.id);
                        return (
                            <div key={c.id} onClick={() => { if (isSelectMode) { setSelectedIds(prev => isSelected ? prev.filter(id => id !== c.id) : [...prev, c.id]); } else { setDetailCard(c); } }} className={`group bg-white rounded-2xl p-5 border-2 transition flex flex-col h-44 shadow-sm relative cursor-pointer ${isSelected ? 'border-indigo-500 bg-indigo-50/30' : 'border-transparent hover:border-indigo-300'}`}>
                                <div onClick={(e) => { e.stopPropagation(); setSelectedIds(prev => isSelected ? prev.filter(id => id !== c.id) : [...prev, c.id]); }} className={`absolute top-3 left-3 w-5 h-5 rounded-md border flex items-center justify-center transition ${isSelected ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-white border-gray-200 opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}>{isSelected && <i className="fas fa-check text-[10px]"></i>}</div>
                                <div className="font-bold text-gray-700 line-clamp-4 flex-1 text-sm pt-4 flex items-center justify-center text-center">{c.front}</div>
                                <button onClick={(e) => { e.stopPropagation(); onMoveToTrash('card', c); }} className="absolute top-3 right-3 text-gray-200 hover:text-rose-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition"><i className="fas fa-trash-can text-xs"></i></button>
                            </div>
                        );
                    })}
                </div>
                {detailCard && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex flex-col items-center justify-center p-6" onClick={() => setDetailCard(null)}>
                        <button className="absolute top-8 right-8 text-white text-2xl hover:scale-110 transition"><i className="fas fa-times"></i></button>
                        <div className="anki-container w-full max-w-lg aspect-[4/3] relative" onClick={(e) => e.stopPropagation()}>
                            <div className={`anki-card ${isFlipped ? 'is-flipped' : ''}`} onClick={() => setIsFlipped(!isFlipped)}>
                                <div className="anki-face anki-front">
                                    <div className="text-indigo-300 text-[10px] font-bold mb-4 uppercase tracking-widest">Question (Preview)</div>
                                    <div className="flex-grow flex items-center justify-center w-full px-4 text-2xl font-bold">{detailCard.front}</div>
                                    <div className="mt-4 text-gray-300 text-[8px] font-bold">点击翻转查看答案</div>
                                    <button onClick={(e) => { e.stopPropagation(); const cardToEdit = detailCard; setDetailCard(null); setModal({ type: 'card', title: '编辑卡片', defaultVal1: cardToEdit.front, defaultVal2: cardToEdit.back, defaultVal3: cardToEdit.category || '默认', existingCategories: categoryList, onConfirm: (f, b, c) => { setData({ ...fullData, cards: cards.map(card => card.id === cardToEdit.id ? { ...card, front: f, back: b, category: c } : card) }); showToast('修改已保存'); } }); }} className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center bg-gray-50 hover:bg-indigo-500 text-gray-400 hover:text-white rounded-full transition-all"><i className="fas fa-pen text-[9px]"></i></button>
                                </div>
                                <div className="anki-face anki-back">
                                    <div className="text-indigo-600 text-[10px] font-bold mb-4 uppercase tracking-widest">Answer (Preview)</div>
                                    <div className="flex-grow flex items-center justify-center w-full px-4 overflow-y-auto custom-scrollbar text-xl text-gray-600">{detailCard.back}</div>
                                    <div className="mt-4 text-indigo-200 text-[8px] font-bold">点击回到正面</div>
                                    <button onClick={(e) => { e.stopPropagation(); const cardToEdit = detailCard; setDetailCard(null); setModal({ type: 'card', title: '编辑卡片', defaultVal1: cardToEdit.front, defaultVal2: cardToEdit.back, defaultVal3: cardToEdit.category || '默认', existingCategories: categoryList, onConfirm: (f, b, c) => { setData({ ...fullData, cards: cards.map(card => card.id === cardToEdit.id ? { ...card, front: f, back: b, category: c } : card) }); showToast('修改已保存'); } }); }} className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center bg-white/50 hover:bg-indigo-500 text-indigo-400 hover:text-white rounded-full transition-all"><i className="fas fa-pen text-[9px]"></i></button>
                                </div>
                            </div>
                        </div>
                        <p className="mt-8 text-white/50 text-xs font-bold tracking-widest uppercase">Click outside to close preview</p>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar flex flex-col items-center" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 35px)' }}>
            <div className="w-full max-w-5xl flex justify-between items-end mb-8 md:mb-12">
                <div><h1 className="text-2xl md:text-3xl font-bold text-gray-800">卡片文件夹</h1><p className="text-xs text-gray-400 mt-2 tracking-wide uppercase">Collection Decks</p></div>
                <div className="flex gap-2">
                    <button onClick={() => setModal({ type: 'input', title: '新建卡片分类', onConfirm: (catName) => { if(!catName) return; const placeholderCard = { id: Date.now(), front: `✨ ${catName} 分类已创建`, back: '这是系统自动生成的占位卡片，你可以点击“编辑”来修改它，或者直接往这个分类里添加新卡片。', category: catName }; setData({ ...fullData, cards: [placeholderCard, ...cards] }); showToast(`分类 [${catName}] 已创建`, 'success'); } })} className="px-4 py-2 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-xl text-sm font-bold hover:bg-indigo-100 transition"><i className="fas fa-folder-plus mr-2"></i>新建分类</button>
                    <button onClick={()=>setModal({ type:'card', title:'新建卡片', existingCategories: categoryList, onConfirm:(f,b,c)=>setData({...fullData, cards:[{id:Date.now(), front:f, back:b, category: c}, ...cards]}) })} className="px-4 py-2 md:px-6 bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg hover:bg-indigo-600 transition">新建卡片</button>
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8 w-full max-w-5xl">
                {categoryList.map(cat => {
                    const style = DECK_COLORS[fullData.deckStyles?.[cat] || 0];
                    return (
                        <div key={cat} onClick={() => { setActiveCategory(cat); setViewMode('list'); }} className="group cursor-pointer bg-white rounded-3xl p-6 md:p-8 shadow-sm hover:shadow-xl transition relative border border-gray-100 overflow-hidden">
                            <div className={`absolute top-0 left-0 w-2 h-full ${style.bg}`}></div>
                            <div className="flex items-center justify-between mb-4">
                                <div className={`w-12 h-12 ${style.light} rounded-2xl flex items-center justify-center ${style.text}`}><i className="fas fa-folder-open text-xl"></i></div>
                                <button onClick={(e) => { e.stopPropagation(); setModal({ type: 'editDeck', title: '管理卡片集', oldName: cat, colorIdx: fullData.deckStyles?.[cat] || 0, onConfirm: updateCategory }); }} className="text-gray-400 hover:text-indigo-400 transition opacity-100 md:opacity-0 md:group-hover:opacity-100"><i className="fas fa-ellipsis-h"></i></button>
                            </div>
                            <h3 className="text-xl font-bold text-gray-700">{cat}</h3>
                            <div className={`mt-6 flex items-center gap-2 ${style.text} opacity-100 md:opacity-0 md:group-hover:opacity-100 transition`}><span className="text-[10px] font-bold uppercase">Open Deck</span><i className="fas fa-arrow-right text-xs"></i></div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* 🌸 通用小抄本组件 */
function StickyBook({ data, setData, onClose, showToast, initialState, onSaveState }) {
    const [activeIndex, setActiveIndex] = useState(0);
    const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
    
    const boxRef = useRef(null);
    const sidebarRef = useRef(null);
    
    const defaultState = { x: window.innerWidth - 340, y: 100, w: 320, h: 420, sidebarW: 120 };
    const state = { ...defaultState, ...initialState };
    const sidebarWidthRef = useRef(state.sidebarW); 

    const books = data.stickyBook || [];

    useEffect(() => {
        if (!data.stickyBook || data.stickyBook.length === 0) {
            setData({ ...data, stickyBook: [{ id: Date.now(), title: '常用公式', content: '' }] });
        }
    }, []);

    const updateBook = (key, value) => {
        const newBooks = [...books];
        newBooks[activeIndex] = { ...newBooks[activeIndex], [key]: value };
        setData({ ...data, stickyBook: newBooks });
    };

    const addNewPage = () => {
        const newPage = { id: Date.now(), title: '新便签', content: '' };
        setData({ ...data, stickyBook: [...books, newPage] });
        setActiveIndex(books.length);
    };

    const deletePage = (e, index) => {
        e.stopPropagation();
        if (books.length <= 1) return;
        const newBooks = books.filter((_, i) => i !== index);
        setActiveIndex(0);
        setData({ ...data, stickyBook: newBooks });
    };

    const currentPage = books[activeIndex] || { title: '', content: '' };

    const saveCurrentState = () => {
        if (boxRef.current && onSaveState) {
            const rect = boxRef.current.getBoundingClientRect();
            onSaveState({ x: rect.left, y: rect.top, w: rect.width, h: rect.height, sidebarW: sidebarWidthRef.current });
        }
    };

    const handleMouseDown = (e) => {
        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('textarea') || e.target.closest('.resizer')) return;
        e.preventDefault();
        const box = boxRef.current;
        const startX = e.clientX;
        const startY = e.clientY;
        const rect = box.getBoundingClientRect();
        const startLeft = rect.left;
        const startTop = rect.top;

        const onMove = (moveEvent) => { box.style.left = `${startLeft + moveEvent.clientX - startX}px`; box.style.top = `${startTop + moveEvent.clientY - startY}px`; };
        const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); saveCurrentState(); };
        window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
    };

    const handleResizeDown = (e) => {
        e.preventDefault(); e.stopPropagation();
        const box = boxRef.current;
        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = box.offsetWidth;
        const startHeight = box.offsetHeight;

        const onMove = (moveEvent) => {
            const newW = Math.max(250, startWidth + (moveEvent.clientX - startX));
            const newH = Math.max(200, startHeight + (moveEvent.clientY - startY));
            box.style.width = `${newW}px`; box.style.height = `${newH}px`;
        };
        const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); saveCurrentState(); };
        window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
    };

    const handleSidebarResize = (e) => {
        e.preventDefault(); e.stopPropagation();
        const startX = e.clientX;
        if (isSidebarCollapsed) { setSidebarCollapsed(false); sidebarWidthRef.current = 40; sidebarRef.current.style.width = '40px'; }
        const startW = sidebarWidthRef.current;

        const onMove = (moveEvent) => {
            const newW = Math.max(40, Math.min(300, startW + (moveEvent.clientX - startX)));
            sidebarRef.current.style.width = `${newW}px`; sidebarWidthRef.current = newW;
        };
        const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); saveCurrentState(); };
        window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
    };

    return (
        <div ref={boxRef} onMouseDown={handleMouseDown} className="fixed z-[150] flex bg-[#fefce8] rounded-r-2xl rounded-l-lg shadow-[0_20px_50px_rgba(0,0,0,0.2)] border-l-8 border-yellow-600 overflow-hidden animate-in zoom-in-95 duration-200" style={{ left: state.x + 'px', top: state.y + 'px', width: state.w + 'px', height: state.h + 'px', touchAction: 'none' }}>
            <div ref={sidebarRef} className={`bg-yellow-50/80 border-r border-yellow-200/50 flex flex-col p-1 relative shrink-0 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? '!w-10' : ''}`} style={{ width: state.sidebarW + 'px' }}>
                <div className="flex-1 flex flex-col overflow-hidden cursor-move">
                    <div className="absolute left-[-10px] top-0 bottom-0 flex flex-col justify-evenly pointer-events-none">{[...Array(6)].map((_,i) => <div key={i} className="w-3.5 h-3.5 rounded-full bg-gray-800 shadow-inner"></div>)}</div>
                    <div className={`flex-1 flex flex-col transition-opacity duration-200 ${isSidebarCollapsed ? 'opacity-0 pointer-events-none hidden' : 'opacity-100'}`}>
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 pr-0.5 mt-2">
                            {books.map((book, idx) => (
                                <div key={book.id} onMouseDown={(e) => e.stopPropagation()} onClick={() => setActiveIndex(idx)} className={`group px-2 py-1.5 rounded-md text-[10px] font-bold cursor-pointer flex justify-between items-center transition ${activeIndex === idx ? 'bg-yellow-400 text-yellow-900' : 'text-yellow-700 hover:bg-yellow-100'}`}>
                                    <span className="truncate">{book.title || '无标题'}</span>
                                    {books.length > 1 && (<button onClick={(e) => deletePage(e, idx)} className="opacity-0 group-hover:opacity-100 text-red-500 text-[8px]"><i className="fas fa-times"></i></button>)}
                                </div>
                            ))}
                        </div>
                        <button onMouseDown={(e)=>e.stopPropagation()} onClick={addNewPage} className="mt-2 w-full py-1.5 bg-yellow-200/50 hover:bg-yellow-300 text-yellow-800 rounded-md text-[9px] font-bold transition border border-dashed border-yellow-400 whitespace-nowrap overflow-hidden">+ 新页</button>
                    </div>
                    <div className={`absolute inset-0 flex flex-col items-center pt-4 gap-2 transition-opacity duration-200 ${!isSidebarCollapsed ? 'opacity-0 pointer-events-none hidden' : 'opacity-100'}`}>
                        <i className="fas fa-book text-yellow-600/50 mb-2"></i>
                        {books.map((_, i) => (<div key={i} className={`w-1.5 h-1.5 rounded-full ${i === activeIndex ? 'bg-yellow-500' : 'bg-yellow-200'}`}></div>))}
                    </div>
                </div>
                <button onMouseDown={(e) => e.stopPropagation()} onClick={() => { setSidebarCollapsed(!isSidebarCollapsed); if (isSidebarCollapsed) { setTimeout(() => sidebarRef.current.style.width = sidebarWidthRef.current + 'px', 0); } }} className="mt-2 w-full py-1 text-yellow-600/50 hover:bg-yellow-100 rounded cursor-pointer flex items-center justify-center transition"><i className={`fas ${isSidebarCollapsed ? 'fa-angles-right' : 'fa-angles-left'} text-[10px]`}></i></button>
                <div className="resizer absolute top-0 right-0 bottom-0 w-2 cursor-col-resize hover:bg-yellow-400/30 transition z-50" onMouseDown={handleSidebarResize} title="拖动调整宽度"></div>
            </div>

            <div className="flex-1 flex flex-col p-4 relative bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:15px_15px] cursor-default min-w-0">
                <div className="flex items-center border-b border-yellow-200 pb-1 mb-2 gap-1">
                    <input className="bg-transparent text-sm font-bold text-gray-700 outline-none flex-1 hover:bg-yellow-50 px-1 rounded transition min-w-0" value={currentPage.title} onChange={(e) => updateBook('title', e.target.value)} onMouseDown={(e)=>e.stopPropagation()} placeholder="标题..." />
                    <button onClick={onClose} className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-rose-500 transition shrink-0"><i className="fas fa-times text-xs"></i></button>
                </div>
                <textarea className="flex-1 bg-transparent resize-none outline-none text-gray-600 text-sm leading-relaxed font-mono custom-scrollbar" placeholder="存入通用内容..." value={currentPage.content} onChange={(e) => updateBook('content', e.target.value)} onMouseDown={(e)=>e.stopPropagation()}></textarea>
                <div className="flex justify-between items-center mt-2">
                    <span className="text-[8px] text-yellow-600/30 font-bold uppercase select-none">v5.2 Memory</span>
                    <button onClick={() => { if(!currentPage.content) return; navigator.clipboard.writeText(currentPage.content); showToast('✨ 已复制', 'success'); }} className="bg-gray-800 hover:bg-black text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-lg transition active:scale-90 flex items-center gap-1.5"><i className="fas fa-copy"></i> 复制</button>
                </div>
            </div>

            <div onMouseDown={handleResizeDown} className="resizer absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-end justify-end p-1 z-50 hover:bg-black/5 rounded-tl-lg">
                <div className="w-2 h-2 border-r-2 border-b-2 border-yellow-600/50"></div>
            </div>
        </div>
    );
}

/* 🌸 引用内容对照窗 */
function ReferenceWindow({ data, onClose, initialState, onSaveState }) {
    const boxRef = useRef(null);
    const contentRef = useRef(null);
    const [keyword, setKeyword] = useState('');
    const [matchCount, setMatchCount] = useState(0);
    const [showSidebar, setShowSidebar] = useState(false);
    const [sidebarTab, setSidebarTab] = useState('toc'); 
    const [tocList, setTocList] = useState([]);
    const [noteList, setNoteList] = useState([]);

    const defaultState = { x: window.innerWidth / 2 - 250, y: 80, w: 600, h: 550 };
    const state = { ...defaultState, ...initialState };

    const performSearch = (term, isFlashMode = false) => {
        if (!contentRef.current || !data.content) return;
        const resetContent = () => {
            contentRef.current.innerHTML = data.content;
            if(!isFlashMode) setMatchCount(0);
            if (window.renderMathInElement) window.renderMathInElement(contentRef.current, { delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}], throwOnError: false });
        };

        if (!term || !term.trim()) { resetContent(); return; }

        const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const originalHtml = data.content;
        let safeTerm = escapeRegExp(term);
        let regex = new RegExp(`(${safeTerm})(?![^<]*>)`, 'gi');
        
        if (!regex.test(originalHtml) && term.length > 8) {
            const headTerm = escapeRegExp(term.substring(0, 8));
            regex = new RegExp(`(${headTerm})(?![^<]*>)`, 'gi');
        }

        let count = 0;
        const highlightClass = isFlashMode ? 'search-target-highlight' : 'ref-highlight bg-yellow-300 text-black font-bold border-b-2 border-yellow-500 transition-all duration-500';
        const highlightedHtml = originalHtml.replace(regex, (match) => { count++; return `<span class="${highlightClass}">${match}</span>`; });

        if (count === 0) { if(!isFlashMode) resetContent(); return; }

        contentRef.current.innerHTML = highlightedHtml;
        if (!isFlashMode) setMatchCount(count);

        setTimeout(() => {
            const selector = isFlashMode ? '.search-target-highlight' : '.ref-highlight';
            const firstMatch = contentRef.current.querySelector(selector);
            if (firstMatch) {
                firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
                if (!isFlashMode) { firstMatch.style.transform = 'scale(1.2)'; setTimeout(() => firstMatch.style.transform = 'scale(1)', 500); }
            }
        }, 100);

        if (window.renderMathInElement) window.renderMathInElement(contentRef.current, { delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}], throwOnError: false });
    };

    useEffect(() => {
        if (!contentRef.current) return;
        contentRef.current.innerHTML = data.content;
        const headers = contentRef.current.querySelectorAll('h1, h2, h3');
        setTocList(Array.from(headers).map((h, i) => ({ id: h.id || `ref-h-${i}`, text: h.innerText, tag: h.tagName, el: h })));
        const notes = contentRef.current.querySelectorAll('.note-link');
        setNoteList(Array.from(notes).map((n, i) => ({ id: `ref-n-${i}`, text: n.getAttribute('data-note'), original: n.innerText, el: n })));
        if (window.renderMathInElement) window.renderMathInElement(contentRef.current, { delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}], throwOnError: false });
        if (data.anchor) { const anchorText = data.anchor.trim(); setTimeout(() => performSearch(anchorText, true), 300); }
    }, [data]);

    const saveCurrentState = () => { if (boxRef.current && onSaveState) { const rect = boxRef.current.getBoundingClientRect(); onSaveState({ x: rect.left, y: rect.top, w: rect.width, h: rect.height }); } };
    const handleDrag = (e) => {
        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('.content-scroll-area') || e.target.closest('.resizer') || e.target.closest('.sidebar-area')) return;
        const box = boxRef.current; const startX = e.clientX; const startY = e.clientY; const rect = box.getBoundingClientRect(); const startLeft = rect.left; const startTop = rect.top;
        const onMove = (mv) => { box.style.left = `${startLeft + mv.clientX - startX}px`; box.style.top = `${startTop + mv.clientY - startY}px`; };
        const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); saveCurrentState(); };
        window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
    };
    const handleResize = (e) => {
        e.preventDefault(); e.stopPropagation();
        const box = boxRef.current; const startX = e.clientX; const startY = e.clientY; const startW = box.offsetWidth; const startH = box.offsetHeight;
        const onMove = (mv) => { box.style.width = `${Math.max(400, startW + (mv.clientX - startX))}px`; box.style.height = `${Math.max(300, startH + (mv.clientY - startY))}px`; };
        const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); saveCurrentState(); };
        window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
    };
    const scrollToTarget = (element) => { if (element) { element.scrollIntoView({ behavior: 'smooth', block: 'center' }); element.classList.add('search-target-highlight'); setTimeout(() => element.classList.remove('search-target-highlight'), 2000); } };

    return (
        <div ref={boxRef} onMouseDown={handleDrag} className="fixed z-[160] bg-white rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-indigo-100 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" style={{ left: state.x + 'px', top: state.y + 'px', width: state.w + 'px', height: state.h + 'px', touchAction: 'none' }}>
            <div className="bg-indigo-50/90 backdrop-blur-sm p-2 border-b border-indigo-100 flex justify-between items-center cursor-move select-none shrink-0 gap-2 h-12">
                <div className="flex items-center gap-2 overflow-hidden px-1 flex-1">
                    <span className="bg-indigo-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0">引用</span>
                    <div className="flex-1 relative group">
                        <input className="w-full bg-white/60 focus:bg-white border border-transparent focus:border-indigo-300 rounded-lg py-1 pl-7 pr-8 text-xs font-bold text-indigo-900 outline-none transition-all placeholder-indigo-300" placeholder="搜索引用内容..." value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && performSearch(keyword, false)} />
                        <i className="fas fa-search absolute left-2 top-1.5 text-xs text-indigo-300"></i>
                        {keyword ? <button onClick={() => { setKeyword(''); performSearch('', false); }} className="absolute right-1 top-1 w-5 h-5 flex items-center justify-center text-indigo-300 hover:text-rose-500"><i className="fas fa-times"></i></button> : <div className="absolute right-2 top-1.5 text-[10px] text-indigo-300 opacity-50">Enter</div>}
                    </div>
                    {keyword && matchCount > 0 && <span className="text-[10px] font-bold text-amber-500 whitespace-nowrap">{matchCount} 处</span>}
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => setShowSidebar(!showSidebar)} className={`w-8 h-8 flex items-center justify-center rounded-lg transition ${showSidebar ? 'bg-indigo-200 text-indigo-700' : 'hover:bg-indigo-100 text-indigo-400'}`} title="显示大纲/批注"><i className="fas fa-list-ul text-xs"></i></button>
                    <div className="w-px h-4 bg-indigo-200 mx-1"></div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-rose-500 hover:text-white rounded-lg text-indigo-300 transition"><i className="fas fa-times text-xs"></i></button>
                </div>
            </div>
            <div className="flex-1 flex overflow-hidden relative">
                <div className={`sidebar-area bg-gray-50 border-r border-gray-100 flex flex-col transition-all duration-300 ease-in-out ${showSidebar ? 'w-48 opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
                    <div className="flex border-b border-gray-200 bg-gray-100">
                        <button onClick={() => setSidebarTab('toc')} className={`flex-1 py-2 text-[10px] font-bold ${sidebarTab === 'toc' ? 'bg-white text-indigo-600 border-b-2 border-indigo-500' : 'text-gray-400 hover:text-gray-600'}`}>大纲</button>
                        <button onClick={() => setSidebarTab('notes')} className={`flex-1 py-2 text-[10px] font-bold ${sidebarTab === 'notes' ? 'bg-white text-indigo-600 border-b-2 border-indigo-500' : 'text-gray-400 hover:text-gray-600'}`}>批注</button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {sidebarTab === 'toc' ? (
                            tocList.length > 0 ? tocList.map((item, i) => (
                                <button key={i} onClick={() => scrollToTarget(item.el)} className={`w-full text-left py-1.5 px-2 rounded hover:bg-indigo-50 text-xs truncate transition flex items-center ${item.tag === 'H1' ? 'font-bold text-gray-700' : 'text-gray-500 pl-4'}`}><span className="truncate">{item.text}</span></button>
                            )) : <div className="text-center text-gray-300 text-[10px] py-10">无标题</div>
                        ) : (
                            noteList.length > 0 ? noteList.map((note, i) => (
                                <button key={i} onClick={() => scrollToTarget(note.el)} className="w-full text-left p-2 rounded hover:bg-rose-50 border border-transparent hover:border-rose-100 group mb-1"><div className="flex items-center gap-1 mb-1"><div className="w-1 h-1 rounded-full bg-rose-400"></div><span className="text-[10px] font-bold text-gray-400 truncate">{note.original}</span></div><div className="text-[10px] text-gray-600 line-clamp-2">{note.text}</div></button>
                            )) : <div className="text-center text-gray-300 text-[10px] py-10">无批注</div>
                        )}
                    </div>
                </div>
                <div className="content-scroll-area flex-1 overflow-y-auto custom-scrollbar p-6 bg-white relative scroll-smooth">
                    <div ref={contentRef} className="editor-core text-sm leading-relaxed text-gray-600"></div>
                    <div className="h-20"></div>
                </div>
            </div>
            <div className="resizer absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-end justify-end p-1 z-50 hover:bg-indigo-50 rounded-tl-lg transition" onMouseDown={handleResize}><div className="w-2 h-2 border-r-2 border-b-2 border-indigo-300"></div></div>
        </div>
    );
}

/* 🌸 搜索弹窗组件 */
function SearchModal({ config, data, onClose, onNavigate }) {
    const [term, setTerm] = useState('');
    
    const stripHtml = (html) => {
        const tmp = document.createElement("DIV"); tmp.innerHTML = html; return tmp.textContent || tmp.innerText || "";
    };

    const results = React.useMemo(() => {
        if (!term.trim()) return [];
        const res = [];
        const searchAll = config.type === 'global';
        
        data.notebooks.forEach(nb => {
            if (!searchAll && nb.id !== config.nbId) return;
            nb.pages.forEach(pg => {
                const pureContent = stripHtml(pg.content);
                const searchTerm = term.toLowerCase();
                const lowerContent = pureContent.toLowerCase();
                let matchCounter = 0;

                if (pg.title.toLowerCase().includes(searchTerm)) {
                    res.push({ nbId: nb.id, nbName: nb.name, pgId: pg.id, title: pg.title, snippet: "✨ 匹配到标题", matchType: '标题' });
                }

                let startPos = 0;
                while ((startPos = lowerContent.indexOf(searchTerm, startPos)) !== -1) {
                    const snippetStart = Math.max(0, startPos - 15);
                    const snippetEnd = Math.min(pureContent.length, startPos + 35);
                    const snippet = (snippetStart > 0 ? "..." : "") + pureContent.substring(snippetStart, snippetEnd) + "...";
                    res.push({ nbId: nb.id, nbName: nb.name, pgId: pg.id, title: pg.title, snippet: snippet, matchType: '正文', matchIndex: matchCounter++ });
                    startPos += searchTerm.length; 
                }
            });
        });
        return res;
    }, [term, data, config]);

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-start justify-center pt-20 modal-overlay" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-[90%] md:w-[600px] max-h-[80vh] flex flex-col modal-enter overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b flex items-center gap-3 bg-gray-50">
                    <i className="fas fa-search text-gray-400"></i>
                    <input className="flex-1 bg-transparent outline-none text-gray-700 font-bold" placeholder={config.type === 'global' ? "全局搜索笔记..." : "在当前笔记本中搜索..."} value={term} onChange={e => setTerm(e.target.value)} />
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 px-2">ESC</button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-gray-50/50">
                    {term && results.length === 0 && <div className="text-center py-10 text-gray-400 text-sm">未找到相关内容</div>}
                    {results.map((item, idx) => (
                        <div key={idx} onClick={() => { if (config.onPick) { config.onPick(item); onClose(); } else { onNavigate(item.nbId, item.pgId, { term: term, index: item.matchIndex }); } }} className="p-3 mb-2 bg-white rounded-xl border border-gray-100 hover:border-indigo-300 hover:shadow-md cursor-pointer transition group">
                            <div className="flex justify-between items-center mb-1">
                                <div className="flex items-center gap-2"><span className="text-[10px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded font-bold">{item.nbName}</span><span className="font-bold text-gray-700">{item.title}</span></div>
                                <span className="text-[10px] text-gray-300 group-hover:text-indigo-300">跳转 <i className="fas fa-arrow-right"></i></span>
                            </div>
                            <div className="text-xs text-gray-400 pl-1 border-l-2 border-gray-200 truncate">{item.snippet}</div>
                        </div>
                    ))}
                </div>
                <div className="p-2 border-t bg-white text-center text-[10px] text-gray-400">共找到 {results.length} 条结果</div>
            </div>
        </div>
    );
}

/* 🌸 通用模态框容器 */
function ModalContainer({ config, onClose }) {
    const [val1, setVal1] = useState(config.oldName || config.defaultVal1 || '');
    const [val2, setVal2] = useState(config.type === 'card' ? (config.defaultVal2 || '') : (config.colorIdx || 0));
    const [val3, setVal3] = useState(config.defaultVal3 || '默认分类');

    if (config.type === 'editDeck') {
        return (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center modal-overlay" onClick={onClose}>
                <div className="bg-white rounded-2xl shadow-2xl w-[90%] md:w-96 p-6 md:p-8 modal-enter" onClick={e => e.stopPropagation()}>
                    <h3 className="text-xl font-bold text-gray-800 mb-6 text-center">{config.title}</h3>
                    <div className="space-y-6 mb-8">
                        <div><label className="text-[10px] font-bold text-gray-400 block mb-2 uppercase tracking-widest">集名</label><input className="w-full bg-gray-50 rounded-xl px-4 py-3 outline-none border-2 border-transparent focus:border-indigo-100" value={val1} onChange={e=>setVal1(e.target.value)} /></div>
                        <div><label className="text-[10px] font-bold text-gray-400 block mb-3 uppercase tracking-widest">标识颜色</label><div className="flex justify-between">{DECK_COLORS.map((c, i) => <div key={i} onClick={() => setVal2(i)} className={`w-8 h-8 rounded-full cursor-pointer ${c.bg} border-4 transition ${val2 === i ? 'border-indigo-100 scale-125' : 'border-white'}`}></div>)}</div></div>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={onClose} className="flex-1 py-3 text-gray-400 font-bold">取消</button>
                        <button onClick={() => { config.onConfirm(config.oldName, val1, val2); onClose(); }} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 transition">保存修改</button>
                    </div>
                </div>
            </div>
        );
    }

    if (config.type === 'batchAction') {
        return (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center modal-overlay" onClick={onClose}>
                <div className="bg-white rounded-2xl shadow-2xl w-[80%] md:w-80 p-6 md:p-8 modal-enter" onClick={e => e.stopPropagation()}>
                    <h3 className="text-lg font-bold text-gray-800 mb-6 text-center">{config.title}</h3>
                    <div className="space-y-2 mb-8 max-h-60 overflow-y-auto custom-scrollbar">
                        {config.categories.map(cat => (
                            <button key={cat} onClick={() => { config.onConfirm(cat); onClose(); }} className="w-full text-left px-4 py-3 rounded-xl hover:bg-indigo-50 text-gray-600 font-bold transition flex items-center justify-between"><span>{cat}</span><i className="fas fa-chevron-right text-[10px] opacity-30"></i></button>
                        ))}
                    </div>
                    <button onClick={onClose} className="w-full py-2 text-gray-400 font-bold">取消</button>
                </div>
            </div>
        );
    }

    if (config.type === 'ai') {
        return (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center modal-overlay">
                <div className="bg-white rounded-2xl shadow-2xl w-[90%] md:w-96 p-6 modal-enter" onClick={e => e.stopPropagation()}>
                    <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">{config.title}</h3>
                    <textarea className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm h-40 outline-none focus:ring-2 focus:ring-indigo-200 mb-4" placeholder="粘贴 Markdown 内容..." autoFocus value={val1} onChange={e=>setVal1(e.target.value)}></textarea>
                    <div className="flex gap-3">
                        <button onClick={() => { config.onConfirm(val1, 'insert'); onClose(); }} className="flex-1 py-2 bg-white border border-indigo-200 text-indigo-500 hover:bg-indigo-50 rounded-lg font-bold text-xs"><i className="fas fa-arrow-pointer mr-1"></i>插入光标处</button>
                        <button onClick={() => { config.onConfirm(val1, 'append'); onClose(); }} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow text-xs"><i className="fas fa-file-arrow-down mr-1"></i>追加到文末</button>
                    </div>
                </div>
            </div>
        );
    }

    if (config.type === 'symbol') {
        return (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center modal-overlay" onClick={onClose}>
                <div className="bg-white rounded-2xl shadow-2xl w-[95%] md:w-[500px] p-6 modal-enter" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold">✨ 符号库</h3><button onClick={onClose} className="text-gray-400 hover:text-gray-600"><i className="fas fa-times"></i></button></div>
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar p-1">
                        {Object.entries(SYMBOLS).map(([cat, chars]) => (
                            <div key={cat}><h4 className="text-[10px] font-bold text-indigo-400 mb-2">{cat}</h4><div className="grid grid-cols-8 gap-2">{chars.map(char => <button key={char} onClick={() => { config.onConfirm(char); onClose(); }} className="aspect-square bg-gray-50 hover:bg-indigo-50 rounded text-lg">{char}</button>)}</div></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (config.type === 'printConfig') {
        return (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center modal-overlay" onClick={onClose}>
                <div className="bg-white rounded-2xl shadow-2xl w-[90%] md:w-80 p-6 md:p-8 modal-enter" onClick={e => e.stopPropagation()}>
                    <h3 className="text-xl font-bold text-gray-800 mb-6 text-center">🖨️ 导出 PDF 设置</h3>
                    <div className="space-y-4 mb-8">
                        <button onClick={() => { const targetPage = config.notebook.pages.find(p => p.id === config.defaultPageId); const pages = config.defaultPageId ? [targetPage] : config.notebook.pages; const fileName = targetPage ? targetPage.title : '章节导出'; config.onConfirm(pages, fileName); }} className="w-full py-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-2xl font-bold transition flex items-center justify-center gap-3"><i className="fas fa-file-lines"></i> 导出当前章节</button>
                        <button onClick={() => { config.onConfirm(config.notebook.pages, config.notebook.name); }} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 transition flex items-center justify-center gap-3"><i className="fas fa-book"></i> 导出整本笔记</button>
                    </div>
                    <button onClick={onClose} className="w-full py-2 text-gray-400 font-bold hover:text-gray-600 transition">取消</button>
                </div>
            </div>
        );
    }

    if (config.type === 'importChoice') {
        return (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center modal-overlay" onClick={onClose}>
                <div className="bg-white rounded-2xl shadow-2xl w-[90%] md:w-[450px] p-8 modal-enter relative overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-indigo-500"></div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2 text-center">📂 读取到备份文件</h3>
                    <p className="text-sm text-gray-500 text-center mb-8 px-4">请选择数据的导入方式：</p>
                    <div className="space-y-4">
                        <button onClick={() => { config.onMerge(); onClose(); }} className="w-full p-4 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-xl transition flex items-center gap-4 group text-left"><div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-xl group-hover:scale-110 transition">🧬</div><div><div className="font-bold text-sm">智能合并 (推荐)</div><div className="text-[10px] opacity-70 mt-0.5">保留现有笔记，仅添加新内容</div></div><i className="fas fa-chevron-right ml-auto opacity-30"></i></button>
                        <button onClick={() => { config.onOverwrite(); onClose(); }} className="w-full p-4 bg-white hover:bg-rose-50 border border-gray-200 hover:border-rose-200 text-gray-600 hover:text-rose-600 rounded-xl transition flex items-center gap-4 group text-left"><div className="w-10 h-10 rounded-full bg-gray-100 group-hover:bg-white flex items-center justify-center shadow-sm text-xl group-hover:scale-110 transition">💥</div><div><div className="font-bold text-sm">完全覆盖</div><div className="text-[10px] opacity-70 mt-0.5">清空当前所有数据，替换为新文件</div></div><i className="fas fa-chevron-right ml-auto opacity-30"></i></button>
                    </div>
                    <button onClick={onClose} className="w-full mt-6 py-2 text-gray-300 text-xs font-bold hover:text-gray-500 transition">取消导入</button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center modal-overlay" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-[90%] md:w-[400px] p-6 md:p-8 modal-enter" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-gray-800 mb-6 text-center">{config.title || '信息确认'}</h3>
                {config.type === 'card' ? (
                    <div className="space-y-5 mb-8">
                        <div><label className="text-[10px] font-bold text-gray-400 block mb-2 uppercase tracking-widest">分类 (Deck)</label><div className="flex flex-wrap gap-2 mb-3">{(config.existingCategories || []).map(c => (<button key={c} onClick={() => setVal3(c)} className={`px-3 py-1 rounded-full text-[10px] font-bold border transition ${val3 === c ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>{c}</button>))}</div><input className="w-full bg-gray-50 rounded-xl px-4 py-2.5 text-sm outline-none border-2 border-transparent focus:border-indigo-100" placeholder="或输入新分类..." value={val3} onChange={e=>setVal3(e.target.value)} /></div>
                        <div><label className="text-[10px] font-bold text-gray-400 block mb-2 uppercase tracking-widest">正面 (Front)</label><textarea className="w-full bg-gray-50 rounded-xl p-4 text-sm h-28 outline-none border-2 border-transparent focus:border-indigo-100" autoFocus value={val1} onChange={e=>setVal1(e.target.value)}></textarea></div>
                        <div><label className="text-[10px] font-bold text-gray-400 block mb-2 uppercase tracking-widest">背面 (Back)</label><textarea className="w-full bg-gray-50 rounded-xl p-4 text-sm h-28 outline-none border-2 border-transparent focus:border-indigo-100" value={val2} onChange={e=>setVal2(e.target.value)}></textarea></div>
                    </div>
                ) : (
                    <div className="mb-6">
                        {config.msg && <p className="text-gray-500 text-center mb-6 text-sm">{config.msg}</p>}
                        {config.type === 'input' && <textarea className="w-full bg-gray-100 rounded-xl px-5 py-3 outline-none border-2 border-transparent focus:border-indigo-300 min-h-[120px] text-sm leading-relaxed resize-none" value={val1} onChange={e=>setVal1(e.target.value)} autoFocus placeholder="请输入内容（支持换行）..." />}
                        {config.type === 'createNotebook' && <div><input className="w-full bg-gray-100 rounded-xl px-5 py-3 mb-6 outline-none" placeholder="笔记本名称" value={val1} onChange={e=>setVal1(e.target.value)} autoFocus /><div className="flex justify-center gap-3">{COLORS.map((c, i) => <div key={i} onClick={() => setVal2(i)} className={`w-10 h-10 rounded-full cursor-pointer ${c.bg} border-4 ${val2 === i ? 'border-indigo-500 scale-110' : 'border-white'}`}></div>)}</div></div>}
                    </div>
                )}
                <div className="flex gap-4">
                    <button onClick={onClose} className="flex-1 py-3 text-gray-400 hover:bg-gray-50 rounded-xl font-bold transition">取消</button>
                    <button onClick={() => { config.onConfirm(val1, val2, val3); onClose(); }} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 transition">确定</button>
                </div>
            </div>
        </div>
    );
}

/* 🌸 书架视图组件 */
function ShelfView({ data, setData, onOpen, setModal, onMoveToTrash }) {
    const [draggedNbIdx, setDraggedNbIdx] = useState(null);

    const handleNbDragOver = (e, index) => {
        e.preventDefault(); 
        if (draggedNbIdx === null || draggedNbIdx === index) return;
        const newNotebooks = [...data.notebooks];
        const draggedItem = newNotebooks[draggedNbIdx];
        newNotebooks.splice(draggedNbIdx, 1);
        newNotebooks.splice(index, 0, draggedItem);
        setDraggedNbIdx(index);
        setData({ ...data, notebooks: newNotebooks });
    };

    return (
        <div className="flex-1 p-4 md:p-8 overflow-y-auto flex flex-col items-center" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 35px)' }}>
            <div className="flex items-center gap-4 mb-10 mt-4 md:mt-0">
                <h1 className="text-3xl font-bold text-gray-700 font-sans">我的书架</h1>
                <button onClick={() => window.triggerSearch({ type: 'global' })} className="w-10 h-10 bg-white rounded-full shadow-sm text-gray-400 hover:text-indigo-500 hover:shadow-md transition flex items-center justify-center"><i className="fas fa-search"></i></button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-10 w-full max-w-6xl pb-20 md:pb-0">
                {data.notebooks.map((nb, index) => {
                    const c = COLORS[nb.colorIdx] || COLORS[0];
                    return (
                        <div 
                            key={nb.id} draggable onDragStart={() => setDraggedNbIdx(index)} onDragOver={(e) => handleNbDragOver(e, index)} onDragEnd={() => setDraggedNbIdx(null)} onClick={() => onOpen(nb.id)} 
                            className={`aspect-[3/4] ${c.bg} rounded-r-2xl rounded-l-md shadow-md cursor-pointer transition flex flex-col p-4 md:p-5 border-l-4 md:border-l-8 ${c.border} relative group ${draggedNbIdx === index ? 'opacity-30 scale-95 border-dashed border-indigo-300' : 'hover:-translate-y-2'}`}
                        >
                            <div className="mt-6 md:mt-10 flex flex-col items-center gap-2">
                                <h3 className={`mt-6 md:mt-10 text-lg md:text-xl font-bold ${c.text} text-center line-clamp-2 select-none`}>{nb.name}</h3>
                                <button onClick={(e) => { e.stopPropagation(); setModal({ type: 'createNotebook', title: '修改封面', defaultVal1: nb.name, colorIdx: nb.colorIdx, onConfirm: (newName, newColor) => { const newData = {...data}; const target = newData.notebooks.find(n => n.id === nb.id); if(target) { target.name = newName; target.colorIdx = newColor; } setData(newData); } }); }} className="absolute bottom-2 right-2 w-7 h-7 bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-white hover:text-indigo-500 shadow-sm"><i className="fas fa-pen text-[10px]"></i></button>
                            </div>
                            <div className="mt-auto text-[10px] text-center text-gray-400 select-none">{nb.pages.length} 个章节</div>
                            <button onClick={(e)=>{ e.stopPropagation(); setModal({type:'confirm', title:'移至回收站', msg:'确定要删除吗？', onConfirm:()=>onMoveToTrash('notebook', nb)}) }} className="absolute top-2 right-2 md:top-3 md:right-3 text-black/20 md:text-black/10 hover:text-rose-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition"><i className="fas fa-trash-can"></i></button>
                        </div>
                    )
                })}
                <div onClick={() => setModal({ type: 'createNotebook', title: '新笔记本', onConfirm: (name, color) => setData({...data, notebooks: [...data.notebooks, {id: Date.now(), name, colorIdx: color, pages: []}]}) })} className="aspect-[3/4] border-4 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-gray-300 cursor-pointer hover:bg-white hover:border-indigo-300 hover:text-indigo-400 transition"><i className="fas fa-plus text-3xl mb-2"></i><span className="text-xs font-bold">创建笔记本</span></div>
            </div>
        </div>
    )
}

/* 🌸 笔记本目录视图组件 */
function NotebookView({ notebook, onBack, onOpenPage, setModal, setData, fullData, onMoveToTrash, onPrintClick }) {
    if (!notebook) return null;
    const color = COLORS[notebook.colorIdx] || COLORS[0];
    const [draggedIdx, setDraggedIdx] = useState(null);

    const handleDragOver = (e, index) => {
        e.preventDefault();
        if (draggedIdx === null || draggedIdx === index) return;
        const newPages = [...notebook.pages];
        const draggedItem = newPages[draggedIdx];
        newPages.splice(draggedIdx, 1);
        newPages.splice(index, 0, draggedItem);
        setDraggedIdx(index);
        setData({ ...fullData, notebooks: fullData.notebooks.map(nb => nb.id === notebook.id ? { ...nb, pages: newPages } : nb) });
    };

    return (
        <div className="flex-1 bg-white flex flex-col h-full overflow-hidden relative">
            <div className={`min-h-[120px] md:h-40 ${color.bg} flex flex-col justify-end p-4 md:p-8 relative transition-all`}>
                <button onClick={onBack} className="absolute left-4 md:top-6 md:left-6 w-8 h-8 bg-white/40 rounded-full hover:bg-white flex items-center justify-center transition" style={{ top: 'calc(env(safe-area-inset-top) + 15px)' }}><i className="fas fa-arrow-left"></i></button>
                <div className="flex items-center gap-3">
                    <h1 className={`text-2xl md:text-4xl font-bold ${color.text}`}>{notebook.name}</h1>
                    <button onClick={() => window.triggerSearch({ type: 'local', nbId: notebook.id })} className="w-8 h-8 bg-white/20 hover:bg-white/50 rounded-full text-white/80 flex items-center justify-center transition backdrop-blur-sm"><i className="fas fa-search text-sm"></i></button>
                </div>
                <button onClick={() => onPrintClick(notebook)} className="absolute right-4 md:top-6 md:right-6 bg-white/80 px-3 py-1 md:px-4 md:py-1.5 rounded-lg shadow-sm text-xs md:text-sm font-bold text-gray-600 hover:bg-white transition" style={{ top: 'calc(env(safe-area-inset-top) + 15px)' }}><i className="fas fa-print mr-2"></i>PDF</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                <div className="max-w-4xl mx-auto space-y-3 pb-20 md:pb-0">
                    {notebook.pages.map((p, i) => (
                        <div key={p.id} draggable onDragStart={() => setDraggedIdx(i)} onDragOver={(e) => handleDragOver(e, i)} onDragEnd={() => setDraggedIdx(null)} onClick={() => onOpenPage(p.id)} className={`group flex items-center justify-between p-4 md:p-5 border rounded-2xl cursor-pointer transition ${draggedIdx === i ? 'opacity-30 scale-95 border-indigo-400' : 'hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-50'}`}>
                            <div className="flex items-center gap-3 md:gap-5">
                                <div className="text-gray-200 group-hover:text-indigo-200 cursor-move hidden md:block"><i className="fas fa-grip-vertical"></i></div>
                                <span className="text-indigo-200 font-bold italic w-6">{i+1}</span>
                                <h3 className="font-bold text-gray-700 line-clamp-1">{p.title}</h3>
                            </div>
                            <div className="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition shrink-0">
                                <button onClick={(e) => { e.stopPropagation(); setModal({ type: 'input', title: '重命名章节', defaultVal1: p.title, onConfirm: (newTitle) => { if(!newTitle) return; const newData = {...fullData}; const nb = newData.notebooks.find(n => n.id === notebook.id); const pg = nb?.pages.find(pg => pg.id === p.id); if(pg) pg.title = newTitle; setData(newData); } }); }} className="w-8 h-8 flex items-center justify-center bg-gray-50 hover:bg-indigo-50 text-indigo-400 rounded-lg transition"><i className="fas fa-pen text-xs"></i></button>
                                <button onClick={(e)=>{ e.stopPropagation(); setModal({type:'confirm', title:'删除章节', msg:'将移至回收站', onConfirm:()=>onMoveToTrash('page', p, notebook.id)}); }} className="w-8 h-8 flex items-center justify-center bg-gray-50 hover:bg-rose-50 text-rose-400 rounded-lg transition"><i className="fas fa-trash-can text-xs"></i></button>
                            </div>
                        </div>
                    ))}
                    <button onClick={()=>setModal({type:'input', title:'新建章节', onConfirm:(t)=>{ const newNb={...notebook, pages:[...notebook.pages, {id:Date.now(), title:t, content:`<h1>${t}</h1><p>`}]}; setData({...fullData, notebooks:fullData.notebooks.map(n=>n.id===notebook.id?newNb:n)}); }})} className="w-full py-4 border-2 border-dashed border-gray-100 rounded-2xl text-gray-300 hover:text-indigo-400 hover:border-indigo-200 font-bold transition">插入新章节</button>
                </div>
            </div>
        </div>
    )
}

/* 🌸 回收站视图组件 */
function TrashView({ trash, onRestore, onDelete }) {
    return (
        <div className="flex-1 p-4 md:p-10 overflow-y-auto flex flex-col items-center" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 35px)' }}>
            <h1 className="text-2xl font-bold text-gray-700 mb-8 mt-4 md:mt-0">回收站 ({trash.length})</h1>
            <div className="w-full max-w-4xl space-y-4 pb-20 md:pb-0">
                {trash.map(t => (
                    <div key={t.trashId} className="bg-white border-2 border-transparent hover:border-gray-100 p-4 rounded-2xl flex items-center justify-between shadow-sm">
                        <div className="overflow-hidden">
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase mr-2 ${t.type==='notebook'?'bg-indigo-100 text-indigo-500': t.type==='page'?'bg-emerald-100 text-emerald-500':'bg-amber-100 text-amber-500'}`}>{t.type}</span>
                            <h4 className="inline font-bold text-gray-700 truncate">{t.type==='notebook'?t.data.name : t.type==='page'?t.data.title : t.data.front}</h4>
                            <div className="text-[10px] text-gray-400 mt-1 italic">删除于: {t.deletedAt}</div>
                        </div>
                        <div className="flex gap-2 shrink-0"><button onClick={()=>onRestore(t.trashId)} className="w-9 h-9 flex items-center justify-center bg-gray-50 hover:bg-emerald-50 text-emerald-500 rounded-xl transition"><i className="fas fa-rotate-left"></i></button><button onClick={()=>onDelete(t.trashId)} className="w-9 h-9 flex items-center justify-center bg-gray-50 hover:bg-rose-50 text-rose-500 rounded-xl transition"><i className="fas fa-xmark"></i></button></div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* 🌸 基础 UI 按钮组件 */
const NavBtn = ({icon, active, onClick, title}) => <button onClick={onClick} title={title} className={`w-10 h-10 rounded-xl flex items-center justify-center transition ${active?'bg-indigo-500 text-white shadow-lg shadow-indigo-200':'text-gray-400 hover:bg-gray-100'}`}><i className={`fas ${icon}`}></i></button>;

const Btn = ({text, icon, onClick, color, title}) => (
    <button 
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }} 
        onClick={(e) => { e.preventDefault(); onClick(e); }} 
        title={title} 
        className={`w-8 h-8 flex items-center justify-center rounded-lg active:bg-gray-300 hover:bg-gray-200 text-xs font-bold transition shrink-0 ${color||'text-gray-600'}`}
    >
        {icon ? <i className={`fas ${icon}`}></i> : text}
    </button>
);

const Toast = ({msg, type}) => <div className={`fixed top-8 left-1/2 -translate-x-1/2 px-8 py-3 rounded-full shadow-2xl text-white font-bold z-[999] toast-enter whitespace-nowrap ${type==='error'?'bg-rose-500':'bg-indigo-600'}`}>{msg}</div>;