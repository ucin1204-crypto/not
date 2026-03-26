// ==========================================
// 🌸 functions.js: 全局原生与纯逻辑函数库
// ==========================================

function renderMarkdownText() {
    console.log("开始尝试读取文字...");

    try {
        // 1. 获取文字：假设你的输入框 ID 是 'my-textarea'
        // 🚩 请根据你的 HTML 实际 ID 修改这里
        const inputElement = document.getElementById('my-textarea'); 
        
        if (!inputElement) {
            console.error("找不到 ID 为 'my-textarea' 的输入框");
            return;
        }

        const rawText = inputElement.value; // 如果是 <div> 请用 innerText
        console.log("成功获取文字，长度为:", rawText.length);

        // 2. 检查解析引擎
        if (typeof marked === 'undefined') {
            console.error("marked.js 未能正确加载，请检查文件路径");
            return;
        }

        // 3. 解析转换
        console.log("正在使用 marked 进行解析...");
        const htmlResult = marked.parse(rawText);

        // 4. 显示结果：假设显示区域 ID 是 'content-display'
        // 🚩 请根据你的 HTML 实际 ID 修改这里
        const displayArea = document.getElementById('content-display');
        if (displayArea) {
            displayArea.innerHTML = htmlResult;
            console.log("🎉 渲染成功！");
        } else {
            console.error("找不到显示容器 'content-display'");
        }

    } catch (err) {
        console.error("发生意外错误: " + err.message);
    }
}