document.addEventListener('DOMContentLoaded', () => {
    // Navigasi Tab & General Elements
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

    // --- ALGORITMA OBE (ELEMENTARY ROW OPERATIONS) ---
    function solveMatrixWithOBE(originalMatrix, op) {
        let A = JSON.parse(JSON.stringify(originalMatrix)); // Clone matrix
        let steps = "";
        let rows = A.length;
        let cols = A[0].length;

        function addStep(msg, currentMatrix) {
            steps += `<div style="margin-bottom:15px; border-bottom:1px solid #333; padding-bottom:5px;">`;
            steps += `<p style="font-weight:700; color:#ff00c8;">Langkah: ${msg}</p>`;
            steps += formatMatrixHTML(currentMatrix);
            steps += `</div>`;
        }

        addStep("Matriks Awal", A);

        // Algoritma Eliminasi Gauss-Jordan (OBE)
        let pivotRow = 0;
        for (let j = 0; j < cols && pivotRow < rows; j++) {
            // 1. Cari Pivot terbesar di kolom j (Partial Pivoting)
            let maxRow = pivotRow;
            for (let i = pivotRow + 1; i < rows; i++) {
                if (Math.abs(A[i][j]) > Math.abs(A[maxRow][j])) maxRow = i;
            }

            if (Math.abs(A[maxRow][j]) < 1e-10) continue; // Kolom kosong/nol

            // 2. Tukar baris jika perlu
            if (maxRow !== pivotRow) {
                [A[pivotRow], A[maxRow]] = [A[maxRow], A[pivotRow]];
                addStep(`R${pivotRow+1} ↔ R${maxRow+1}`, A);
            }

            // 3. Buat pivot menjadi 1 (Normalisasi)
            let divisor = A[pivotRow][j];
            if (divisor !== 1) {
                A[pivotRow] = A[pivotRow].map(x => x / divisor);
                addStep(`R${pivotRow+1} = R${pivotRow+1} / ${divisor.toFixed(2)}`, A);
            }

            // 4. Eliminasi Baris lain (Atas & Bawah untuk Gauss-Jordan)
            for (let i = 0; i < rows; i++) {
                if (i !== pivotRow) {
                    let factor = A[i][j];
                    if (Math.abs(factor) > 1e-10) {
                        A[i] = A[i].map((x, idx) => x - factor * A[pivotRow][idx]);
                        addStep(`R${i+1} = R${i+1} - (${factor.toFixed(2)} * R${pivotRow+1})`, A);
                    }
                }
            }
            pivotRow++;
        }

        return { final: A, steps: steps };
    }

    // --- MAIN SOLVE ACTION ---
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
                const engine = await Tesseract.recognize(canvas.toDataURL('image/jpeg'), 'eng');
                matrix = reconstructMatrix(engine.data.words);
            } else {
                matrix = getMatrixDataFromGrid(matrixA, rowsInput.value, colsInput.value);
            }

            if (!matrix) throw new Error("Gagal mengenali matriks.");

            displayedDetectedMatrix(matrix);

            // LOGIKA OBE UNTUK SEMUA OPERASI
            const op = operationSelect.value;
            let res = null;

            if (op === 'gauss-jordan' || op === 'inverse' || op === 'determinant') {
                const obe = solveMatrixWithOBE(matrix, op);
                res = {
                    display: formatMatrixHTML(obe.final),
                    steps: obe.steps
                };
            } else {
                // Fallback untuk operasi dasar lain
                res = solveMatrixAlgorithmic(matrix, op);
            }

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

    // --- HELPERS ---
    function formatMatrixHTML(raw) {
        let html = '<div style="display:inline-block; border-left: 2px solid #fff; border-right: 2px solid #fff; padding: 5px; margin: 10px 0;">';
        raw.forEach(r => {
            html += '<div style="display:flex; justify-content: center; gap: 15px; margin: 3px 0;">';
            r.forEach(c => {
                 let val = Math.abs(c) < 1e-10 ? 0 : c; // Bersihkan noise kecil
                 html += `<span style="color:#00d4ff; width: 40px; text-align:center;">${Number.isInteger(val) ? val : val.toFixed(2)}</span>`;
            });
            html += '</div>';
        });
        html += '</div>';
        return html;
    }

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
