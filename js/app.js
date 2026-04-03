document.addEventListener('DOMContentLoaded', () => {
    // Navigasi Tab
    const btnScanTab = document.getElementById('btn-scan');
    const btnManualTab = document.getElementById('btn-manual');
    const scanView = document.getElementById('scan-view');
    const manualView = document.getElementById('manual-view');
    const btnText = document.getElementById('btn-text');

    // Matrix Elements
    const matrixA = document.getElementById('matrix-container');
    const matrixB = document.getElementById('matrix-container-b');
    const matrixBSection = document.getElementById('matrix-b-section');
    const rowsInput = document.getElementById('rows');
    const colsInput = document.getElementById('cols');
    const updateGridBtn = document.getElementById('update-grid');

    // General App Elements
    const video = document.getElementById('camera-feed');
    const canvas = document.getElementById('capture-canvas');
    const captureBtn = document.getElementById('capture-btn');
    const resultPanel = document.getElementById('result-panel');
    const closeResult = document.getElementById('close-result');
    const operationSelect = document.getElementById('matrix-operation');
    const recommendedAnswer = document.getElementById('recommended-answer');
    const patternReasoning = document.getElementById('pattern-reasoning');
    const detectedMatrixView = document.getElementById('detected-matrix-view');
    const loadingState = document.querySelector('.loading-state');
    const dataState = document.querySelector('.data-state');

    let currentMode = 'scan';
    let stream = null;

    // --- TAB SWITCHING ---
    btnScanTab.addEventListener('click', () => {
        currentMode = 'scan';
        btnScanTab.classList.add('active');
        btnManualTab.classList.remove('active');
        scanView.classList.remove('hidden');
        manualView.classList.add('hidden');
        btnText.textContent = "SCAN & SOLVE";
    });

    btnManualTab.addEventListener('click', () => {
        currentMode = 'manual';
        btnScanTab.classList.remove('active');
        btnManualTab.classList.add('active');
        scanView.classList.add('hidden');
        manualView.classList.remove('hidden');
        btnText.textContent = "CALCULATE MANUAL";
        createGrid(matrixA, rowsInput.value, colsInput.value);
    });

    // --- CAMERA INIT ---
    async function initCamera() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: 1280, height: 720 } });
            video.srcObject = stream;
        } catch (e) { alert('Kamera tidak dapat diakses.'); }
    }

    // --- GRID MANUAL LOGIC ---
    function createGrid(container, r, c) {
        container.innerHTML = '';
        container.style.gridTemplateColumns = `repeat(${c}, 50px)`;
        for(let i=0; i < r*c; i++) {
            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'matrix-cell';
            input.value = '0';
            container.appendChild(input);
        }
    }

    updateGridBtn.addEventListener('click', () => {
        createGrid(matrixA, rowsInput.value, colsInput.value);
        if(!matrixBSection.classList.contains('hidden')) createGrid(matrixB, rowsInput.value, colsInput.value);
    });

    operationSelect.addEventListener('change', () => {
        const op = operationSelect.value;
        if(['addition', 'multiplication'].includes(op)) {
            matrixBSection.classList.remove('hidden');
            if(currentMode === 'manual') createGrid(matrixB, rowsInput.value, colsInput.value);
        } else {
            matrixBSection.classList.add('hidden');
        }
    });

    // --- RECONSTRUCTOR ALGORITHM ---
    function reconstructMatrix(words) {
        const numbers = words.filter(w => /^-?\d+([.,]\d+)?$/.test(w.text));
        if (numbers.length === 0) return null;
        const rows = [];
        numbers.forEach(num => {
            let found = false;
            for (let row of rows) {
                const avgY = row.reduce((sum, n) => sum + n.bbox.y0, 0) / row.length;
                if (Math.abs(num.bbox.y0 - avgY) < (num.bbox.y1 - num.bbox.y0) * 0.8) {
                    row.push(num);
                    found = true;
                    break;
                }
            }
            if (!found) rows.push([num]);
        });
        rows.sort((a, b) => a[0].bbox.y0 - b[0].bbox.y0);
        return rows.map(row => {
            row.sort((a, b) => a.bbox.x0 - b.bbox.x0);
            return row.map(n => Number(n.text.replace(',', '.')));
        });
    }

    // --- IMAGE PRE-PROCESSING (FOR BETTER SCAN) ---
    function preprocessImage(ctx, w, h) {
        const imgData = ctx.getImageData(0, 0, w, h);
        for (let i = 0; i < imgData.data.length; i += 4) {
            const avg = (imgData.data[i] + imgData.data[i+1] + imgData.data[i+2]) / 3;
            const res = avg > 128 ? 255 : 0; // Binarization
            imgData.data[i] = imgData.data[i+1] = imgData.data[i+2] = res;
        }
        ctx.putImageData(imgData, 0, 0);
    }

    // --- SOLVE BUTTON ACTION ---
    captureBtn.addEventListener('click', async () => {
        resultPanel.classList.remove('hidden');
        setTimeout(() => resultPanel.classList.add('show'), 10);
        loadingState.classList.remove('hidden');
        dataState.classList.add('hidden');

        try {
            let matrix = null;
            if (currentMode === 'scan') {
                const context = canvas.getContext('2d');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                // Pre-process for Tesseract
                preprocessImage(context, canvas.width, canvas.height);
                const engine = await Tesseract.recognize(canvas.toDataURL('image/jpeg'), 'eng');
                matrix = reconstructMatrix(engine.data.words);
                if (!matrix) throw new Error("Gagal membaca matriks. Coba arahkan lebih jelas atau gunakan mode MANUAL.");
            } else {
                matrix = getMatrixDataFromGrid(matrixA, rowsInput.value, colsInput.value);
            }

            displayedDetectedMatrix(matrix);
            const res = solveMatrixAlgorithmic(matrix, operationSelect.value);
            recommendedAnswer.innerHTML = res.display;
            patternReasoning.innerHTML = res.steps;

            loadingState.classList.add('hidden');
            dataState.classList.remove('hidden');
        } catch (err) {
            recommendedAnswer.textContent = "Oops!";
            patternReasoning.textContent = err.message;
            loadingState.classList.add('hidden');
            dataState.classList.remove('hidden');
        }
    });

    function getMatrixDataFromGrid(container, r, c) {
        const ins = container.querySelectorAll('input');
        const m = [];
        for(let i=0; i<r; i++) {
            const row = [];
            for(let j=0; j<c; j++) row.push(Number(ins[i*c + j].value));
            m.push(row);
        }
        return m;
    }

    function solveMatrixAlgorithmic(A, op) {
        try {
            let result = null;
            let steps = "Penyelesaian menggunakan algoritma matriks standar.";
            if (op === 'determinant') result = math.det(A);
            else if (op === 'inverse') result = math.inv(A);
            else if (op === 'transpose') result = math.transpose(A);
            else if (op === 'rank') result = math.rank(A);
            
            return {
                display: typeof result === 'number' ? result.toFixed(2) : formatMatrixHTML(result),
                steps: steps
            };
        } catch (e) { throw new Error("Kesalahan hitung: Matriks mungkin tidak memiliki solusi (Det=0)."); }
    }

    function formatMatrixHTML(m) {
        const raw = m.toArray ? m.toArray() : m;
        let html = '<div style="display:inline-block; border-left: 2px solid #fff; border-right: 2px solid #fff; padding: 5px;">';
        raw.forEach(r => {
            html += '<div style="display:flex; justify-content: center; gap: 15px; margin: 3px 0;">';
            r.forEach(c => html += `<span>${Number.isInteger(c) ? c : c.toFixed(2)}</span>`);
            html += '</div>';
        });
        html += '</div>';
        return html;
    }

    function displayedDetectedMatrix(m) {
        detectedMatrixView.innerHTML = `<p style="font-size:0.7rem; color:var(--text-dim);">Matrix ${m.length}x${m[0].length}:</p>${formatMatrixHTML(m)}`;
    }

    closeResult.addEventListener('click', () => {
        resultPanel.classList.remove('show');
        setTimeout(() => resultPanel.classList.add('hidden'), 500);
    });

    initCamera();
    createGrid(matrixA, 3, 3);
});
