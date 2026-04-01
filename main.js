// ==========================================
// 🌸 main.js: App 主组件与渲染入口 (完整版)
// ==========================================

// 🌸 补全 React 钩子声明
const { useState, useEffect, useRef } = React;

// 🌸 Supabase 云端数据库初始化配置
const SUPABASE_URL = 'https://noyrotkufngkujllnxdd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5veXJvdGt1Zm5na3VqbGxueGRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNjc3ODYsImV4cCI6MjA4OTc0Mzc4Nn0.po6tuxDaHzuDipOA4RZKWShmE-cIha1DBY2WdzQCC74';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function App() {
    const [view, setView] = useState('shelf'); 
    const [dictConfig, setDictConfig] = useState(null); 
    
    useEffect(() => { 
        window.triggerDict = (word, x = window.innerWidth/2, y = window.innerHeight/2) => {
            setDictConfig({ word, x, y });
        };
    }, []);

    useEffect(() => {
        const handleGlobalKeys = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
                e.preventDefault(); 
                if (view === 'editor') {
                    if (window.triggerLocalFind) window.triggerLocalFind();
                } else {
                    setSearchConfig({ type: 'global' }); 
                }
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault(); 
                showToast('✨ 已同步保存', 'success');
            }
        };
        window.addEventListener('keydown', handleGlobalKeys);
        return () => window.removeEventListener('keydown', handleGlobalKeys);
    }, [view]);

    // 🌸 修改：初始状态先使用默认数据垫底，防止白屏
    const [data, setData] = useState(typeof defaultData !== 'undefined' ? defaultData : { notebooks: [], cards: [] });
    // 🌸 新增：标记数据是否已经从数据库加载完成
    const [isDataLoaded, setIsDataLoaded] = useState(false);

    // 🌸 新增：组件挂载后，异步去大容量数据库里捞数据
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                // 1. 优先检查 Electron 硬盘环境
                if (typeof require !== 'undefined') {
                    const fs = require('fs');
                    const path = require('path');
                    const savePath = path.join(process.cwd(), 'my_data.json');
                    if (fs.existsSync(savePath)) {
                        const fileData = fs.readFileSync(savePath, 'utf-8');
                        setData(JSON.parse(fileData));
                        setIsDataLoaded(true);
                        return;
                    }
                }
                
                // 2. 网页端环境：从无容量限制的 localForage 读取
                if (typeof localforage !== 'undefined') {
                    const local = await localforage.getItem('lazyNoteV10Data');
                    if (local) {
                        setData(local);
                    }
                }
            } catch (err) {
                console.error('大容量数据库读取失败:', err);
            } finally {
                setIsDataLoaded(true);
            }
        };
        loadInitialData();
    }, []);

    const [activeNbId, setActiveNbId] = useState(null);
    const [activePageId, setActivePageId] = useState(null);
    const [modal, setModal] = useState(null);
    const [referenceData, setReferenceData] = useState(null);

    useEffect(() => {
        window.triggerReference = (nbId, pgId, anchor = null) => {
            const targetNb = data.notebooks.find(n => n.id === nbId);
            if (!targetNb) { showToast('找不到源笔记本', 'error'); return; }
            const targetPage = targetNb.pages.find(p => p.id === pgId);
            if (!targetPage) { showToast('找不到目标章节', 'error'); return; }
            setReferenceData({ title: targetPage.title, content: targetPage.content, anchor: anchor });
        };
    }, [data]);

    const [searchConfig, setSearchConfig] = useState(null);
    const [pendingHighlight, setPendingHighlight] = useState(null);
    const [toast, setToast] = useState(null);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [showSticky, setShowSticky] = useState(false); 

    useEffect(() => { window.triggerSearch = (config) => setSearchConfig(config); }, []);

    useEffect(() => {
        const handleJump = (e) => {
            const { nbId, pgId } = e.detail;
            setActiveNbId(nbId);
            setActivePageId(pgId);
            setView('editor');
        };
        window.addEventListener('JUMP_TO_NOTE', handleJump);
        return () => window.removeEventListener('JUMP_TO_NOTE', handleJump);
    }, []);

    useEffect(() => {
        const handleMessage = async (event) => {
            if (!event.data) return;
            if (event.data.type === 'CREATE_JP_CARD') {
                const { front, back } = event.data;
                const newCard = { id: Date.now(), front, back, category: '日语生词' };
                setData(prev => ({ ...prev, cards: [newCard, ...prev.cards] }));
                showToast('已存入生词本', 'success');
            }
            if (event.data.type === 'JP_LOOKUP') {
                const wordsToLookup = event.data.words;
                const results = {};
                try {
                    let dictData = window.activeDictBuffer;
                    if (!dictData || window.lastLoadedFile !== 'jp') {
                        const res = await fetch('dict/jp.json');
                        dictData = await res.json();
                        window.activeDictBuffer = dictData;
                        window.lastLoadedFile = 'jp';
                    }
                    const list = dictData.words || [];
                    wordsToLookup.forEach(word => {
                        const lowerWord = word.toLowerCase();
                        const entry = list.find(w => (w.kanji && w.kanji.some(k => k.text === lowerWord)) || (w.kana && w.kana.some(k => k.text === lowerWord)));
                        if (entry) {
                            const meaning = entry.sense.slice(0, 2).map((s, i) => {
                                 const text = s.gloss.map(g => (typeof g === 'object' ? g.text : g)).join(';');
                                 return `${i+1}. ${text}`;
                            }).join('\n');
                            const reading = entry.kana && entry.kana.length > 0 ? entry.kana[0].text : '';
                            results[word] = { m: meaning, r: reading };
                        }
                    });
                    const iframe = document.querySelector('iframe');
                    if (iframe) iframe.contentWindow.postMessage({ type: 'JP_RESULTS', results }, '*');
                } catch (e) { console.error("自动查词失败:", e); }
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

// ==========================================
    // 🌸 核心数据持久化逻辑 (已彻底更换为大型数据库方案)
    // ==========================================
    useEffect(() => {
        // 确保只有在数据加载完成后才触发保存，防止把初始空数据给存进去
        if (!isDataLoaded) return; 

        // 1. 网页端：使用 localForage 保存到大容量 IndexedDB 
        // (注：它支持直接存对象，不需要 JSON.stringify，且完全突破 5MB 限制)
        if (typeof localforage !== 'undefined') {
            localforage.setItem('lazyNoteV10Data', data).catch(err => {
                console.error('❌ 大容量存储写入失败:', err);
                alert('存储失败！可能是你的浏览器或设备硬盘空间已满。');
            });
        }

        // 2. Electron 端：保持原样的本地硬盘写入
        if (typeof require !== 'undefined') {
            try {
                const fs = require('fs');
                const path = require('path');
                const savePath = path.join(process.cwd(), 'my_data.json');
                fs.writeFileSync(savePath, JSON.stringify(data, null, 2), 'utf-8');
            } catch (err) { 
                console.error('硬盘保存失败:', err); 
            }
        }
    }, [data, isDataLoaded]);

    const updateWindowState = (key, newState) => {
        setData(prev => ({
            ...prev,
            windowStates: { ...(prev.windowStates || {}), [key]: { ...(prev.windowStates?.[key] || {}), ...newState } }
        }));
    };

    const showToast = (msg, type='info') => {
        setToast({ msg, type, id: Date.now() });
        setTimeout(() => setToast(null), 800);
    };

    // ==========================================
    // 🌸 Supabase 核心上传与下载逻辑
    // ==========================================
    const [isSyncing, setIsSyncing] = useState(false);

    const uploadToCloud = async () => {
        setIsSyncing(true);
        try {
            const { error } = await supabase
                .from('mynote_sync')
                .upsert({ id: 1, data_json: data, updated_at: new Date().toISOString() });
            
            if (error) throw error;
            showToast('✨ 云端同步成功！', 'success');
        } catch (err) {
            console.error(err);
            showToast('同步失败: ' + err.message, 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    const downloadFromCloud = async () => {
        setIsSyncing(true);
        try {
            const { data: dbData, error } = await supabase
                .from('mynote_sync')
                .select('data_json')
                .eq('id', 1)
                .single();
            
            if (error) throw error;
            if (dbData && dbData.data_json && dbData.data_json.notebooks) {
                setModal({
                    type: 'importChoice',
                    onMerge: () => {
                        const newData = { ...data };
                        const importedData = dbData.data_json;
                        importedData.notebooks.forEach(inb => {
                            const exist = newData.notebooks.find(n => n.id === inb.id || n.name === inb.name);
                            if (exist) { exist.pages = [...exist.pages, ...inb.pages.filter(ip => !exist.pages.some(p => p.id === ip.id))]; } 
                            else { newData.notebooks.push(inb); }
                        });
                        const existingCardIds = new Set(newData.cards.map(c => c.id));
                        importedData.cards.forEach(ic => { if (!existingCardIds.has(ic.id)) newData.cards.push(ic); });
                        setData(newData);
                        showToast('云端数据合并成功', 'success');
                    },
                    onOverwrite: () => {
                        setData(dbData.data_json);
                        showToast('云端数据覆盖成功', 'success');
                    }
                });
            } else {
                showToast('云端目前没有数据哦', 'warning');
            }
        } catch (err) {
            console.error(err);
            showToast('拉取失败: ' + err.message, 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    const moveToTrash = (type, item, nbId = null) => {
        const trashItem = { trashId: Date.now(), type, data: item, nbId, deletedAt: new Date().toLocaleString() };
        const newData = {...data, trash: [trashItem, ...(data.trash || [])]};
        if (type === 'notebook') {
            newData.notebooks = data.notebooks.filter(n => n.id !== item.id);
            if (activeNbId === item.id) { setActiveNbId(null); setView('shelf'); }
        } else if (type === 'page') {
            const nb = newData.notebooks.find(n => n.id === nbId);
            if (nb) nb.pages = nb.pages.filter(p => p.id !== item.id);
            if (activePageId === item.id) { setActivePageId(null); setView('notebook'); }
        } else if (type === 'card') {
            newData.cards = data.cards.filter(c => c.id !== item.id);
        }
        setData(newData); showToast(`已移至回收站`);
    };

    const executePrint = (pages, titleName = '未命名') => {
        showToast('正在准备打印数据...', 'info');
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.left = '-10000px'; 
        iframe.style.top = '-10000px';
        iframe.style.width = '1000px'; 
        iframe.style.height = '1000px';
        iframe.style.border = '0';
        iframe.style.zIndex = '-1';
        document.body.appendChild(iframe);

        let contentHtml = '';
        // 🌸 修复点1：给外层套上 editor-core，唤醒所有漂亮样式
        pages.forEach(p => { 
            contentHtml += `<div class="chapter editor-core"><div class="chapter-content">${p.content}</div><div class="page-break"></div></div>`; 
        });

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${titleName}</title>
                <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@500;700&family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet">
                <link rel="stylesheet" href="style.css"> 
                
                <style>
                    html, body {
                        height: auto !important; 
                        overflow: visible !important; 
                        background-color: white !important;
                    }
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    /* 确保每一章都在新的一页开始 */
                    .page-break { page-break-after: always; }
                    /* 打印时去掉多余的阴影和边框，更清爽 */
                    .editor-core { padding: 20px 40px; }
                </style>
            </head>
            <body>
                ${contentHtml}
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            try { window.focus(); window.print(); } finally { window.parent.postMessage('PRINT_DONE', '*'); }
                        }, 1000); 
                    }
                </script>
            </body>
            </html>
        `);
        doc.close();

        const cleanup = (e) => {
            if (e.data === 'PRINT_DONE') {
                showToast('打印任务结束', 'success');
                setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 1000);
                window.removeEventListener('message', cleanup);
            }
        };
        window.addEventListener('message', cleanup);
        setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 300000);
    };

    return (
        <div className={`h-[100dvh] w-screen flex flex-col-reverse md:flex-row cute-bg relative font-sans text-gray-700 ${isDarkMode ? 'dark-mode-active' : ''}`}>
            
            <div className={`w-full md:w-16 bg-white/90 backdrop-blur border-t md:border-t-0 md:border-r border-gray-200 flex-row md:flex-col items-center justify-around md:justify-start md:py-6 md:gap-6 z-30 no-print shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] md:shadow-sm shrink-0 
                ${view === 'editor' ? 'hidden md:flex h-16 md:h-full' : 'flex safe-bottom-nav'}`}>
                <NavBtn icon="fa-home" active={view === 'shelf'} onClick={() => setView('shelf')} title="书架" />
                <NavBtn icon="fa-book-open" active={view === 'notebook' || view === 'editor'} onClick={() => activeNbId ? setView('notebook') : showToast('请先打开笔记本', 'warning')} title="笔记" />
                <NavBtn icon="fa-layer-group" active={view === 'cards'} onClick={() => setView('cards')} title="卡片盒" />
                <NavBtn icon="fa-paste" active={showSticky} onClick={() => setShowSticky(true)} title="便签本" />
                <NavBtn icon="fa-language" active={view === 'jp'} onClick={() => setView('jp')} title="日语解析" />
                <NavBtn icon="fa-gear" active={view === 'backup'} onClick={() => setView('backup')} title="系统设置" />
                <NavBtn icon="fa-trash-can" active={view === 'trash'} onClick={() => setView('trash')} title="回收站" />
            </div>

            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                {view === 'shelf' && <ShelfView data={data} setData={setData} onOpen={(id) => {setActiveNbId(id); setView('notebook');}} setModal={setModal} onMoveToTrash={moveToTrash} />}
                
                {view === 'notebook' && <NotebookView notebook={data.notebooks.find(n => n.id === activeNbId)} onBack={() => setView('shelf')} onOpenPage={(pid) => {setActivePageId(pid); setView('editor');}} setModal={setModal} setData={setData} fullData={data} onMoveToTrash={moveToTrash} onPrintClick={(nb) => setModal({ type: 'printConfig', notebook: nb, onConfirm: executePrint })} />}

                {view === 'editor' && <EditorView notebook={data.notebooks.find(n => n.id === activeNbId)} page={data.notebooks.find(n => n.id === activeNbId)?.pages.find(p => p.id === activePageId)} onCreatePage={(title) => { if (!title) return; const newPage = { id: Date.now(), title: title, content: '' }; const newData = { ...data }; const nb = newData.notebooks.find(n => n.id === activeNbId); if (nb) { nb.pages.push(newPage); setData(newData); setActivePageId(newPage.id); showToast('⚡️ 新章节已创建', 'success'); } }} pendingHighlight={pendingHighlight} setPendingHighlight={setPendingHighlight} onBack={() => setView('notebook')} onSwitchPage={(pid) => setActivePageId(pid)} onSave={(html) => { const newData = {...data}; const nb = newData.notebooks.find(n => n.id === activeNbId); if(nb) { const p = nb.pages.find(pg => pg.id === activePageId); if(p) p.content = html; } setData(newData); }} onAddCard={(f, b, c) => setData({...data, cards: [{id:Date.now(), front:f, back:b, category: c || '默认'}, ...data.cards]})} setModal={setModal} onPrintClick={(nb, pgId) => setModal({ type: 'printConfig', notebook: nb, defaultPageId: pgId, onConfirm: executePrint })} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} showToast={showToast} allCategories={[...new Set(data.cards.map(c => c.category || '默认'))]} />}

                {view === 'cards' && <CardBoxView cards={data.cards} setData={setData} fullData={data} setModal={setModal} onMoveToTrash={moveToTrash} showToast={showToast} />}
                
                {view === 'jp' && (<div className="flex-1 h-full w-full bg-white overflow-hidden"><iframe src="JP Grammar Local.html" className="w-full h-full border-none" title="JP Grammar" /></div>)}
                
                {view === 'trash' && <TrashView trash={data.trash || []} onRestore={(id) => { const item = data.trash.find(t => t.trashId === id); const newData = {...data, trash: data.trash.filter(t => t.trashId !== id)}; if (item.type === 'notebook') newData.notebooks.push(item.data); else if (item.type === 'page') { const nb = newData.notebooks.find(n => n.id === item.nbId); if(nb) nb.pages.push(item.data); } else if (item.type === 'card') { newData.cards.push(item.data); } setData(newData); showToast('已还原'); }} onDelete={(id) => { setData({...data, trash: data.trash.filter(t => t.trashId !== id)}); showToast('已永久删除'); }} />}
                
                {view === 'backup' && (
                    <div className="flex-1 p-4 md:p-10 overflow-y-auto custom-scrollbar flex flex-col items-center" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 35px)' }}>
                        <h1 className="text-2xl font-bold text-gray-700 mb-8 mt-4 md:mt-0">系统设置与备份</h1>
                        <div className="w-full max-w-2xl bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-10 space-y-10">
                            
                            <div>
                                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2"><i className="fas fa-chart-pie"></i> 数据统计</h2>
                                <div className="grid grid-cols-3 gap-3 md:gap-6">
                                    <div className="bg-indigo-50/50 border border-indigo-100/50 rounded-2xl p-4 text-center hover:shadow-md transition">
                                        <div className="text-3xl font-bold text-indigo-600 font-serif">{data.notebooks.length}</div>
                                        <div className="text-[10px] md:text-xs text-indigo-400 mt-1 font-bold">笔记本数量</div>
                                    </div>
                                    <div className="bg-emerald-50/50 border border-emerald-100/50 rounded-2xl p-4 text-center hover:shadow-md transition">
                                        <div className="text-3xl font-bold text-emerald-600 font-serif">{data.notebooks.reduce((acc, nb) => acc + nb.pages.length, 0)}</div>
                                        <div className="text-[10px] md:text-xs text-emerald-400 mt-1 font-bold">总章节数量</div>
                                    </div>
                                    <div className="bg-rose-50/50 border border-rose-100/50 rounded-2xl p-4 text-center hover:shadow-md transition">
                                        <div className="text-3xl font-bold text-rose-600 font-serif">{data.cards.length}</div>
                                        <div className="text-[10px] md:text-xs text-rose-400 mt-1 font-bold">卡片盒存量</div>
                                    </div>
                                </div>
                            </div>

                            {/* 🌸 Supabase 云端同步按钮 UI */}
                            <div>
                                <h2 className="text-xs font-bold text-sky-400 uppercase tracking-widest mb-4 flex items-center gap-2"><i className="fas fa-cloud"></i> Supabase 云端同步</h2>
                                <div className="space-y-4">
                                    <button onClick={uploadToCloud} disabled={isSyncing} className="w-full py-4 bg-sky-50 hover:bg-sky-100 text-sky-600 rounded-2xl font-bold transition flex items-center justify-center gap-3 disabled:opacity-50">
                                        <i className={`fas ${isSyncing ? 'fa-spinner fa-spin' : 'fa-cloud-arrow-up'}`}></i> {isSyncing ? '正在同步到云端...' : '将本地数据推送到云端'}
                                    </button>
                                    <button onClick={downloadFromCloud} disabled={isSyncing} className="w-full py-4 bg-white border-2 border-dashed border-sky-200 hover:border-sky-300 hover:bg-sky-50 text-sky-500 rounded-2xl font-bold transition flex items-center justify-center gap-3 disabled:opacity-50">
                                        <i className={`fas ${isSyncing ? 'fa-spinner fa-spin' : 'fa-cloud-arrow-down'}`}></i> {isSyncing ? '正在拉取数据...' : '从云端拉取覆盖本地'}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2"><i className="fas fa-hard-drive"></i> 本地备份与恢复</h2>
                                <div className="space-y-4">
                                    <button onClick={() => {
                                        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
                                        const downloadAnchorNode = document.createElement('a');
                                        downloadAnchorNode.setAttribute("href", dataStr);
                                        downloadAnchorNode.setAttribute("download", "MYNOTE_Backup_" + new Date().toISOString().slice(0, 10) + ".json");
                                        document.body.appendChild(downloadAnchorNode);
                                        downloadAnchorNode.click();
                                        downloadAnchorNode.remove();
                                        showToast('备份文件已下载', 'success');
                                    }} className="w-full py-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-2xl font-bold transition flex items-center justify-center gap-3">
                                        <i className="fas fa-download"></i> 导出数据备份 (.json)
                                    </button>
                                    
                                    <label className="w-full py-4 bg-white border-2 border-dashed border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 text-gray-500 rounded-2xl font-bold transition flex items-center justify-center gap-3 cursor-pointer group">
                                        <input type="file" accept=".json" className="hidden" onChange={(e) => {
                                            const file = e.target.files[0];
                                            if (!file) return;
                                            const reader = new FileReader();
                                            reader.onload = (event) => {
                                                try {
                                                    const importedData = JSON.parse(event.target.result);
                                                    if (!importedData.notebooks || !importedData.cards) throw new Error('无效的数据格式');
                                                    
                                                    setModal({
                                                        type: 'importChoice',
                                                        onMerge: () => {
                                                            const newData = { ...data };
                                                            importedData.notebooks.forEach(inb => {
                                                                const exist = newData.notebooks.find(n => n.id === inb.id || n.name === inb.name);
                                                                if (exist) { exist.pages = [...exist.pages, ...inb.pages.filter(ip => !exist.pages.some(p => p.id === ip.id))]; } 
                                                                else { newData.notebooks.push(inb); }
                                                            });
                                                            const existingCardIds = new Set(newData.cards.map(c => c.id));
                                                            importedData.cards.forEach(ic => { if (!existingCardIds.has(ic.id)) newData.cards.push(ic); });
                                                            setData(newData);
                                                            showToast('合并导入成功', 'success');
                                                        },
                                                        onOverwrite: () => {
                                                            setData(importedData);
                                                            showToast('覆盖导入成功', 'success');
                                                        }
                                                    });
                                                } catch (err) {
                                                    showToast('读取文件失败，格式不正确', 'error');
                                                }
                                                e.target.value = ''; 
                                            };
                                            reader.readAsText(file);
                                        }} />
                                        <i className="fas fa-upload group-hover:-translate-y-1 transition-transform"></i> 导入数据备份 (.json)
                                    </label>
                                </div>
                            </div>

                            <div className="pt-8 border-t border-gray-100">
                                <h2 className="text-xs font-bold text-rose-400 uppercase tracking-widest mb-4 flex items-center gap-2"><i className="fas fa-triangle-exclamation"></i> 危险区域</h2>
                                <button onClick={() => {
                                    setModal({
                                        type: 'confirm',
                                        title: '清空所有数据',
                                        msg: '警告：你确定要彻底清空所有的笔记本、卡片和回收站吗？此操作不可逆！建议在此之前先导出备份。',
                                        onConfirm: () => {
                                            setData({ notebooks: [], cards: [], trash: [], deckStyles: {}, stickyBook: [] });
                                            showToast('数据已彻底清空', 'success');
                                        }
                                    });
                                }} className="w-full py-4 bg-rose-50 hover:bg-rose-500 hover:text-white text-rose-500 rounded-2xl font-bold transition flex items-center justify-center gap-3">
                                    <i className="fas fa-fire"></i> 彻底清空所有数据
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {modal && <ModalContainer config={modal} onClose={() => setModal(null)} />}
            {dictConfig && <DictBubble config={dictConfig} onClose={() => setDictConfig(null)} />}
            {referenceData && <ReferenceWindow data={referenceData} onClose={() => setReferenceData(null)} initialState={data.windowStates?.reference} onSaveState={(s) => updateWindowState('reference', s)} />}
            {showSticky && <StickyBook data={data} setData={setData} onClose={() => setShowSticky(false)} showToast={showToast} initialState={data.windowStates?.sticky} onSaveState={(s) => updateWindowState('sticky', s)} />}
            {toast && <Toast msg={toast.msg} type={toast.type} />}
            {searchConfig && <SearchModal config={searchConfig} data={data} onClose={() => setSearchConfig(null)} onNavigate={(nbId, pgId, highlightInfo) => { setActiveNbId(nbId); setActivePageId(pgId); setPendingHighlight(highlightInfo); setView('editor'); setSearchConfig(null); }} />}
        </div>
    );
}

// 🌸 执行 React 挂载
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
