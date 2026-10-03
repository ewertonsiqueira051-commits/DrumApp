/* JavaScript ES5: Safari antigo + biblioteca online Supabase. */
(function () {
    'use strict';

    var audioContext = null;
    var audioBuffer = null;
    var sourceNode = null;
    var isPlaying = false;
    var position = 0;
    var anchorTime = 0;
    var effectiveRate = 1;
    var progressInterval = null;
    var loadId = 0;
    var activeReader = null;
    var activeRequest = null;
    var fileName = '';

    var audioUpload = document.getElementById('audio-upload');
    var playPauseBtn = document.getElementById('play-pause-btn');
    var stopBtn = document.getElementById('stop-btn');
    var speedSlider = document.getElementById('speed-slider');
    var pitchSlider = document.getElementById('pitch-slider');
    var speedVal = document.getElementById('speed-val');
    var pitchVal = document.getElementById('pitch-val');
    var progressBar = document.getElementById('progress-bar');
    var currentTimeDisplay = document.getElementById('current-time');
    var totalDurationDisplay = document.getElementById('total-duration');
    var status = document.getElementById('status');

    var config = window.DRUMMAPP_CONFIG || {};
    var libraryButton = null;
    var libraryList = null;

    function message(text, error) {
        status.textContent = text;
        status.className = error ? 'error' : '';
    }

    function enableControls(enabled) {
        playPauseBtn.disabled = !enabled;
        stopBtn.disabled = !enabled;
        speedSlider.disabled = !enabled;
        pitchSlider.disabled = !enabled;
        progressBar.disabled = !enabled;
    }

    function formatTime(seconds) {
        seconds = Math.max(0, Math.floor(seconds || 0));

        var minutes = Math.floor(seconds / 60);
        var remainder = seconds % 60;

        return minutes + ':' +
            (remainder < 10 ? '0' : '') +
            remainder;
    }

    function currentPosition() {
        var result = position;

        if (isPlaying) {
            result +=
                (audioContext.currentTime - anchorTime) *
                effectiveRate;
        }

        return Math.max(
            0,
            Math.min(
                audioBuffer ? audioBuffer.duration : 0,
                result
            )
        );
    }

    function drawProgress() {
        var seconds = currentPosition();

        progressBar.value = seconds;
        currentTimeDisplay.textContent = formatTime(seconds);
    }

    function detachSource() {
        clearInterval(progressInterval);
        progressInterval = null;

        if (sourceNode) {
            sourceNode.onended = null;

            try {
                sourceNode.stop(0);
            } catch (ignoreStop) {}

            try {
                sourceNode.disconnect();
            } catch (ignoreDisconnect) {}

            sourceNode = null;
        }
    }

    function stopAudio() {
        isPlaying = false;
        detachSource();
        position = 0;
        playPauseBtn.textContent = 'Play';
        drawProgress();
    }

    function initAudioContext() {
        if (!audioContext) {
            var Context =
                window.AudioContext ||
                window.webkitAudioContext;

            if (!Context) {
                throw new Error('Web Audio indisponível');
            }

            audioContext = new Context();
        }
    }

    function unlockAudio() {
        initAudioContext();

        if (
            audioContext.resume &&
            audioContext.state !== 'running'
        ) {
            var resumed = audioContext.resume();

            if (resumed && resumed.then) {
                resumed.then(function () {}, function () {
                    pauseAudio();

                    message(
                        'O Safari bloqueou o áudio. ' +
                        'Toque em Play novamente.',
                        true
                    );
                });
            }
        }

        var silent = audioContext.createBufferSource();

        silent.buffer = audioContext.createBuffer(
            1,
            1,
            audioContext.sampleRate || 44100
        );

        silent.connect(audioContext.destination);

        silent.onended = function () {
            try {
                silent.disconnect();
            } catch (ignore) {}
        };

        silent.start(0);
    }

    function pauseAudio() {
        if (!isPlaying) {
            return;
        }

        position = currentPosition();
        isPlaying = false;
        detachSource();
        playPauseBtn.textContent = 'Play';
        drawProgress();
    }

    function playAudio() {
        if (!audioBuffer || isPlaying) {
            return;
        }

        try {
            unlockAudio();

            if (position >= audioBuffer.duration) {
                position = 0;
            }

            var node = audioContext.createBufferSource();

            sourceNode = node;
            node.buffer = audioBuffer;
            node.playbackRate.value = effectiveRate;
            node.connect(audioContext.destination);

            node.onended = function () {
                if (sourceNode !== node || !isPlaying) {
                    return;
                }

                isPlaying = false;
                clearInterval(progressInterval);
                progressInterval = null;

                try {
                    node.disconnect();
                } catch (ignore) {}

                sourceNode = null;
                position = audioBuffer.duration;
                playPauseBtn.textContent = 'Play';
                drawProgress();

                message(
                    'Fim da música. Toque em Play para ouvir novamente.'
                );
            };

            anchorTime = audioContext.currentTime;
            node.start(0, position);
            isPlaying = true;
            playPauseBtn.textContent = 'Pause';

            progressInterval = setInterval(drawProgress, 150);

            message('Reproduzindo: ' + fileName);
        } catch (error) {
            isPlaying = false;
            detachSource();
            playPauseBtn.textContent = 'Play';

            message(
                'Não foi possível iniciar o áudio. ' +
                'Toque em Play novamente.',
                true
            );
        }
    }

    function updateRate() {
        if (isPlaying) {
            position = currentPosition();
            anchorTime = audioContext.currentTime;
        }

        var speed = parseFloat(speedSlider.value);
        var semitones = parseInt(pitchSlider.value, 10);

        effectiveRate =
            speed * Math.pow(2, semitones / 12);

        speedVal.textContent = speed.toFixed(2) + 'x';
        pitchVal.textContent = semitones;

        if (sourceNode) {
            sourceNode.playbackRate.value = effectiveRate;
        }

        drawProgress();
    }

    function resetForNewAudio() {
        stopAudio();

        audioBuffer = null;
        enableControls(false);

        totalDurationDisplay.textContent = '0:00';
        progressBar.max = 100;

        speedSlider.value = 1;
        pitchSlider.value = 0;

        updateRate();
    }

    function failedLoad(text, clearInput) {
        activeReader = null;
        activeRequest = null;
        message(text, true);

        if (clearInput) {
            audioUpload.value = '';
        }
    }

    function decodeArrayBuffer(data, name, thisLoad) {
        message('Preparando o áudio: ' + name + '. Aguarde...');

        try {
            audioContext.decodeAudioData(
                data,
                function (buffer) {
                    if (thisLoad !== loadId) {
                        return;
                    }

                    if (
                        !buffer ||
                        !isFinite(buffer.duration) ||
                        buffer.duration <= 0
                    ) {
                        failedLoad(
                            'O arquivo não contém áudio utilizável.',
                            true
                        );
                        return;
                    }

                    audioBuffer = buffer;
                    position = 0;
                    fileName = name;

                    progressBar.max = buffer.duration;
                    totalDurationDisplay.textContent =
                        formatTime(buffer.duration);

                    drawProgress();
                    enableControls(true);

                    message(
                        'Pronto: ' +
                        fileName +
                        '. Toque em Play.'
                    );
                },
                function () {
                    if (thisLoad !== loadId) {
                        return;
                    }

                    failedLoad(
                        'O Safari não conseguiu decodificar esse áudio. ' +
                        'Tente uma cópia em MP3.',
                        true
                    );
                }
            );
        } catch (decodeError) {
            failedLoad(
                'Falha ao preparar o áudio. Tente outro arquivo.',
                true
            );
        }
    }

    function loadLocalFile(file) {
        var thisLoad = ++loadId;

        if (
            activeReader &&
            activeReader.readyState === 1
        ) {
            activeReader.abort();
        }

        if (activeRequest) {
            try {
                activeRequest.abort();
            } catch (ignoreAbort) {}

            activeRequest = null;
        }

        resetForNewAudio();

        fileName = file.name || 'Áudio';

        function fail(text) {
            if (thisLoad !== loadId) {
                return;
            }

            failedLoad(text, true);
        }

        try {
            unlockAudio();

            if (!window.FileReader) {
                throw new Error('FileReader indisponível');
            }

            if (!file.size) {
                fail(
                    'O arquivo está vazio ou indisponível. ' +
                    'Baixe-o pelo iCloud e tente novamente.'
                );
                return;
            }

            message('Lendo: ' + fileName + '. Aguarde...');

            var reader = new FileReader();

            activeReader = reader;

            reader.onerror = function () {
                fail(
                    'Não foi possível ler o arquivo. ' +
                    'Abra-o no iCloud e aguarde o download.'
                );
            };

            reader.onabort = function () {
                fail('Leitura cancelada.');
            };

            reader.onload = function () {
                if (thisLoad !== loadId) {
                    return;
                }

                activeReader = null;

                decodeArrayBuffer(
                    reader.result,
                    fileName,
                    thisLoad
                );
            };

            reader.readAsArrayBuffer(file);
        } catch (error) {
            fail(
                'Não foi possível abrir o leitor de áudio. ' +
                'Recarregue a página e tente novamente.'
            );
        }
    }

    function loadRemoteFile(file) {
        var thisLoad = ++loadId;
        var base;
        var url;
        var request;

        if (!config.supabaseUrl ||
            !config.supabaseAnonKey ||
            !config.bucket) {
            message(
                'O arquivo config.js não está configurado.',
                true
            );
            return;
        }

        if (activeRequest) {
            try {
                activeRequest.abort();
            } catch (ignoreAbort) {}

            activeRequest = null;
        }

        if (
            activeReader &&
            activeReader.readyState === 1
        ) {
            activeReader.abort();
        }

        resetForNewAudio();

        fileName = file.name || 'Áudio';
        base = config.supabaseUrl.replace(/\/$/, '');

        url = base +
            '/storage/v1/object/public/' +
            encodeURIComponent(config.bucket) +
            '/' +
            encodeURIComponent(fileName);

        message('Baixando: ' + fileName + '. Aguarde...');

        request = new XMLHttpRequest();
        activeRequest = request;

        request.open('GET', url, true);
        request.responseType = 'arraybuffer';

        request.setRequestHeader(
            'apikey',
            config.supabaseAnonKey
        );

        request.setRequestHeader(
            'Authorization',
            'Bearer ' + config.supabaseAnonKey
        );

        request.onload = function () {
            activeRequest = null;

            if (thisLoad !== loadId) {
                return;
            }

            if (
                request.status < 200 ||
                request.status >= 300
            ) {
                failedLoad(
                    'Não foi possível baixar essa música (' +
                    request.status +
                    ').',
                    false
                );
                return;
            }

            try {
                unlockAudio();
            } catch (unlockError) {
                failedLoad(
                    'O áudio foi baixado, mas o Safari bloqueou o player.',
                    false
                );
                return;
            }

            decodeArrayBuffer(
                request.response,
                fileName,
                thisLoad
            );
        };

        request.onerror = function () {
            activeRequest = null;

            if (thisLoad !== loadId) {
                return;
            }

            failedLoad(
                'Não foi possível conectar à biblioteca.',
                false
            );
        };

        request.onabort = function () {
            activeRequest = null;
        };

        request.send(null);
    }

    function createLibraryInterface() {
        var existingButton;
        var existingLink;
        var parent;
        var title;
        var wrapper;

        existingButton =
            document.getElementById('library-load');

        existingLink =
            document.querySelector(
                'a[href="library.html"]'
            );

        if (existingButton) {
            libraryButton = existingButton;
        } else if (existingLink) {
            libraryButton = document.createElement('button');
            libraryButton.type = 'button';
            libraryButton.textContent = 'Minhas músicas';

            existingLink.parentNode.replaceChild(
                libraryButton,
                existingLink
            );
        } else {
            libraryButton = document.createElement('button');
            libraryButton.type = 'button';
            libraryButton.textContent = 'Minhas músicas';

            parent = audioUpload.parentNode;
            parent.insertBefore(
                libraryButton,
                audioUpload
            );
        }

        libraryList = document.createElement('div');
        libraryList.id = 'library-list';
        libraryList.style.margin = '10px 0';

        libraryButton.parentNode.insertBefore(
            libraryList,
            libraryButton.nextSibling
        );

        libraryButton.addEventListener(
            'click',
            loadLibrary
        );
    }

    function loadLibrary() {
        var base;
        var url;
        var request;

        if (!config.supabaseUrl ||
            !config.supabaseAnonKey ||
            !config.bucket) {
            libraryList.innerHTML =
                '<p>Configure o arquivo config.js.</p>';
            return;
        }

        libraryList.innerHTML =
            '<p>Carregando músicas...</p>';

        base = config.supabaseUrl.replace(/\/$/, '');

        url = base +
            '/storage/v1/object/list/' +
            encodeURIComponent(config.bucket);

        request = new XMLHttpRequest();

        request.open('POST', url, true);

        request.setRequestHeader(
            'apikey',
            config.supabaseAnonKey
        );

        request.setRequestHeader(
            'Authorization',
            'Bearer ' + config.supabaseAnonKey
        );

        request.setRequestHeader(
            'Content-Type',
            'application/json'
        );

        request.onload = function () {
            var files;
            var i;
            var button;

            if (
                request.status < 200 ||
                request.status >= 300
            ) {
                libraryList.innerHTML =
                    '<p>Não foi possível carregar as músicas.</p>';
                return;
            }

            try {
                files = JSON.parse(request.responseText);
            } catch (parseError) {
                libraryList.innerHTML =
                    '<p>Resposta inválida da biblioteca.</p>';
                return;
            }

            libraryList.innerHTML = '';

            if (!files || !files.length) {
                libraryList.innerHTML =
                    '<p>Nenhuma música enviada ainda.</p>';
                return;
            }

            for (i = 0; i < files.length; i++) {
                if (!files[i].name) {
                    continue;
                }

                button = document.createElement('button');
                button.type = 'button';
                button.textContent =
                    'Carregar: ' + files[i].name;
                button.style.display = 'block';
                button.style.width = '100%';
                button.style.margin = '6px 0';

                (function (selectedFile) {
                    button.addEventListener(
                        'click',
                        function () {
                            loadRemoteFile(selectedFile);
                        }
                    );
                }(files[i]));

                libraryList.appendChild(button);
            }
        };

        request.onerror = function () {
            libraryList.innerHTML =
                '<p>Não foi possível conectar à biblioteca.</p>';
        };

        request.send(JSON.stringify({
            prefix: '',
            limit: 100,
            offset: 0,
            sortBy: {
                column: 'name',
                order: 'desc'
            }
        }));
    }

    audioUpload.addEventListener(
        'change',
        function (event) {
            var file =
                event.target.files &&
                event.target.files[0];

            if (!file) {
                return;
            }

            loadLocalFile(file);
        }
    );

    playPauseBtn.addEventListener(
        'click',
        function () {
            if (isPlaying) {
                pauseAudio();
                message('Pausado: ' + fileName);
            } else {
                playAudio();
            }
        }
    );

    stopBtn.addEventListener(
        'click',
        function () {
            stopAudio();
            message(
                'Parado. Toque em Play para recomeçar.'
            );
        }
    );

    speedSlider.addEventListener(
        'input',
        updateRate
    );

    speedSlider.addEventListener(
        'change',
        updateRate
    );

    pitchSlider.addEventListener(
        'input',
        updateRate
    );

    pitchSlider.addEventListener(
        'change',
        updateRate
    );

    function seek() {
        if (!audioBuffer) {
            return;
        }

        var requested =
            parseFloat(progressBar.value);

        var wasPlaying = isPlaying;

        pauseAudio();

        position = Math.max(
            0,
            Math.min(audioBuffer.duration, requested)
        );

        drawProgress();

        if (
            wasPlaying &&
            position < audioBuffer.duration
        ) {
            playAudio();
        }
    }

    progressBar.addEventListener(
        'input',
        seek
    );

    progressBar.addEventListener(
        'change',
        seek
    );

    enableControls(false);
    createLibraryInterface();
}());
