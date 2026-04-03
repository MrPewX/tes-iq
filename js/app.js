document.addEventListener('DOMContentLoaded', () => {
    // General Elements
    const btnScanTab = document.getElementById('btn-scan');
    const btnManualTab = document.getElementById('btn-manual');
    const scanView = document.getElementById('scan-view');
    const manualView = document.getElementById('manual-view');
    const btnText = document.getElementById('btn-text');
    const matrixA = document.getElementById('matrix-container');
    const matrixB = document.getElementById('matrix-container-b');
    const matrixBSection = document.getElementById('matrix-b-section');
    const rowsInput = document.getElementById('rows');
    const colsInput = document.getElementById('cols');
    const updateGridBtn = document.getElementById('update-grid');
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

    // --- UTILS ---
    function formatFraction(val) {
        if (Math.abs(val) < 1e-10) return "0";
        try {
            const f = math.fraction(val);
            return f.d === 1 ? f.s * f.n : `${f.s === -1 ? '-' : ''}${f.n}/${f.d}`;
        } catch (e) {
            return val.toFixed(2);
        }
    }

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

    function formatMatrixHTMLWithOBE(matrix, obeNotes = []) {
        let html = `<div style="display:flex; align-items:center; justify-content:center; gap:20px; margin:20px 0;">`;
        
        // Matrix Part
        html += `<div style="border-left:2px solid #fff; border-right:2px solid #fff; padding:0 10px;">`;
        matrix.forEach((row, i) => {
            html += `<div style="display:flex; gap:15px; height:30px; align-items:center;">`;
            row.forEach(cell => {
                html += `<span style="color:#00d4ff; width:45px; text-align:center; font-size:0.8rem;">${formatFraction(cell)}</span>`;
            });
            html += `</div>`;
        });
        html += `</div>`;

        // OBE Notes Part (Aligned to rows)
        html += `<div style="display:flex; flex-direction:column; justify-content:center; gap:0;">`;
        matrix.forEach((_, i) => {
            const note = obeNotes[i] || "";
            html += `<div style="height:30px; display:flex; align-items:center; color:#ff00c8; font-size:0.75rem; font-weight:700; white-space:nowrap;">${note}</div>`;
        });
        html += `</div></div>`;
        return html;
    }

    // --- OBE ENGINE WITH FRACTIONS & SIDEBAR ---
    function solveMatrixWithOBESteps(originalMatrix) {
        let A = JSON.parse(JSON.stringify(originalMatrix));
        let rows = A.length;
        let cols = A[0].length;
        let stepsHTML = `<div style="padding-top:20px;">`;

        function logStep(msg, matrix, notes) {
            stepsHTML += `<div style="border-bottom:1px solid #333; margin-bottom:20px;">`;
            stepsHTML += `<p style="font-size:0.7rem; color:rgba(255,255,255,0.5); text-align:center;">${msg}</p>`;
            stepsHTML += formatMatrixHTMLWithOBE(matrix, notes);
            stepsHTML += `</div>`;
        }

        logStep("MATRIKS AWAL", A, []);

        let pivotRow = 0;
        for (let j = 0; j < cols && pivotRow < rows; j++) {
            let maxRow = pivotRow;
            for (let i = pivotRow + 1; i < rows; i++) {
                if (Math.abs(A[i][j]) > Math.abs(A[maxRow][j])) maxRow = i;
            }

            if (Math.abs(A[maxRow][j]) < 1e-10) continue;

            if (maxRow !== pivotRow) {
                [A[pivotRow], A[maxRow]] = [A[maxRow], A[pivotRow]];
                let notes = [];
                notes[pivotRow] = `R${pivotRow+1} ↔ R${maxRow+1}`;
                notes[maxRow] = `R${maxRow+1} ↔ R${pivotRow+1}`;
                logStep("TUKAR BARIS", A, notes);
            }

            let divisor = A[pivotRow][j];
            if (Math.abs(divisor - 1) > 1e-10) {
                A[pivotRow] = A[pivotRow].map(x => x / divisor);
                let notes = [];
                const fracDev = formatFraction(divisor);
                notes[pivotRow] = `R${pivotRow+1} ÷ (${fracDev})`;
                logStep("NORMALISASI BARIS", A, notes);
            }

            let elimNotes = [];
            let changed = false;
            for (let i = 0; i < rows; i++) {
                if (i !== pivotRow) {
                    let factor = A[i][j];
                    if (Math.abs(factor) > 1e-10) {
                        A[i] = A[i].map((x, idx) => x - factor * A[pivotRow][idx]);
                        const fracFact = formatFraction(factor);
                        elimNotes[i] = `R${i+1} - (${fracFact})R${pivotRow+1}`;
                        changed = true;
                    }
                }
            }
            if (changed) logStep("ELIMINASI KOLOM", A, elimNotes);
            pivotRow++;
        }

        return { final: A, steps: stepsHTML + `</div>` };
    }

    // --- MAIN ACTION ---
    captureBtn.addEventListener('click', async () => {
        resultPanel.classList.remove('hidden');
        setTimeout(() => {
            resultPanel.classList.add('show');
            document.querySelector('.panel-content').scrollTop = 0; // Reset scroll ke atas
        }, 10);
        loadingState.classList.remove('hidden');
        dataState.classList.add('hidden');

        try {
            let matrix = null;
            if (currentMode === 'scan') {
                const context = canvas.getContext('2d');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const engine = await Tesseract.recognize(canvas.toDataURL('image/jpeg'), 'eng');
                matrix = reconstructMatrix(engine.data.words);
            } else {
                const ins = matrixA.querySelectorAll('input');
                const r = rowsInput.value, c = colsInput.value;
                matrix = [];
                for(let i=0; i<r; i++) {
                    const row = [];
                    for(let j=0; j<c; j++) row.push(Number(ins[i*c + j].value));
                    matrix.push(row);
                }
            }

            if (!matrix) throw new Error("Gagal membaca matriks.");

            const obe = solveMatrixWithOBESteps(matrix);
            recommendedAnswer.innerHTML = formatMatrixHTMLWithOBE(obe.final);
            patternReasoning.innerHTML = obe.steps;

            loadingState.classList.add('hidden');
            dataState.classList.remove('hidden');
        } catch (err) {
            recommendedAnswer.textContent = "Error";
            patternReasoning.textContent = err.message;
            loadingState.classList.add('hidden');
            dataState.classList.remove('hidden');
        }
    });

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
        rows.sort((a,b) => a[0].bbox.y0 - b[0].bbox.y0);
        return rows.map(r => {
            r.sort((a,b) => a.bbox.x0 - b.bbox.x0);
            return r.map(n => Number(n.text.replace(',','.')));
        });
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(s => { stream = s; video.srcObject = s; });

    closeResult.addEventListener('click', () => {
        resultPanel.classList.remove('show');
        setTimeout(() => resultPanel.classList.add('hidden'), 500);
    });

    createGrid(matrixA, 3, 3);
});
