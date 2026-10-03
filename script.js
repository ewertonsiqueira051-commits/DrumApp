/* DrummApp 3 — biblioteca integrada, player e realces. */
(function () {
    'use strict';

    function el(id) {
        return document.getElementById(id);
    }

    var cfg = window.DRUMMAPP_CONFIG || {};
    var audio = null;
    var mediaURL = '';
    var objectURL = null;
    var remote = false;
    var trackName = '';
    var ctx = null;
    var source = null;
    var outputNode = null;
    var nodes = [];
    var eqOn = false;

    var libraryBusy = false;
    var libraryLoaded = false;
    var libraryOffset = 0;
    var pageSize = 100;

    var urls = window.URL;
    if (!urls || !urls.createObjectURL) {
        urls = window.webkitURL;
    }

    var profiles = [
        {
            id: 'drums',
            name: 'Bateria',
            bands: [[80, 1, 0.4], [220, 1, 0.3], [4500, 0.8, 0.6]]
        },
        {
            id: 'bass',
            name: 'Baixo',
            bands: [[110, 0.8, 1]]
        },
        {
            id: 'guitar',
            name: 'Guitarra',
            bands: [[1600, 0.8, 1]]
        },
        {
            id: 'keys',
            name: 'Teclado',
            bands: [[700, 0.6, 1]]
        },
        {
            id: 'acoustic',
            name: 'Violão',
            bands: [[250, 0.9, 0.4], [2800, 0.8, 0.7]]
        }
    ];

    function say(text) {
        el('status').textContent = text;
    }

    function controls(enabled) {
        var ids = ['play', 'stop', 'back', 'forward'];
        var i;

        for (i = 0; i < ids.length; i++) {
            el(ids[i]).disabled = !enabled;
        }

        el('activate').disabled = !enabled || eqOn;
        el('restore').disabled = !enabled || !eqOn;
    }

    function createEQControls() {
        var container = el('eq-controls');
        var i;

        for (i = 0; i < profiles.length; i++) {
            var profile = profiles[i];
            var label = document.createElement('label');
            var value = document.createElement('span');
            var slider = document.createElement('input');

            label.htmlFor = 'eq-' + profile.id;
            label.appendChild(document.createTextNode(profile.name));

            value.id = 'value-' + profile.id;
            value.className = 'value';
            value.textContent = '0 dB';
            label.appendChild(value);

            slider.id = 'eq-' + profile.id;
            slider.type = 'range';
            slider.min = '-6';
            slider.max = '6';
            slider.step = '0.5';
            slider.value = '0';
            slider.disabled = true;

            slider.addEventListener('input', updateEQ);
            slider.addEventListener('change', updateEQ);

            container.appendChild(label);
            container.appendChild(slider);
        }
    }

    function resetEQ() {
        eqOn = false;

        for (var i = 0; i < profiles.length; i++) {
            el('eq-' + profiles[i].id).value = '0';
            el('eq-' + profiles[i].id).disabled = true;
            el('value-' + profiles[i].id).textContent = '0 dB';
        }

        el('output').value = '100';
        el('output').disabled = true;
        el('output-value').textContent = '100%';
        el('eq-status').textContent = 'Realces desligados. Som original.';
    }

    function disconnectEQ() {
        if (source) {
            try { source.disconnect(); } catch (ignoreSource) {}
        }

        for (var i = 0; i < nodes.length; i++) {
            try { nodes[i].node.disconnect(); } catch (ignoreNode) {}
        }

        if (outputNode) {
            try { outputNode.disconnect(); } catch (ignoreOutput) {}
        }

        source = null;
        outputNode = null;
        nodes = [];
    }

    function removePlayer() {
        var old = audio;
        audio = null;

        if (old) {
            try {
                old.pause();
                old.removeAttribute('src');
                old.load();
            } catch (ignorePlayer) {}
        }

        disconnectEQ();
        el('player').innerHTML = '';
    }

    function releaseObjectURL() {
        if (objectURL && urls) {
            try {
                urls.revokeObjectURL(objectURL);
            } catch (ignoreURL) {}
        }

        objectURL = null;
    }

    function closeYouTube() {
        el('youtube-player').innerHTML = '';
        el('youtube-actions').style.display = 'none';
        el('youtube-status').textContent =
            'Cole um link e toque em Abrir vídeo.';
    }

    function resumeEffects(player) {
        if (!eqOn || !ctx || !ctx.resume) {
            return;
        }

        try {
            var result = ctx.resume();

            if (result && result.then) {
                result.then(function () {}, function () {
                    if (audio === player && eqOn) {
                        el('eq-status').textContent =
                            'Toque em Play novamente. Se continuar sem som, ' +
                            'use Restaurar som original.';
                    }
                });
            }
        } catch (ignoreResume) {
            el('eq-status').textContent =
                'Não foi possível retomar os realces. ' +
                'Use Restaurar som original.';
        }
    }

    function buildPlayer(position) {
        var player = document.createElement('audio');
        var pending = position || 0;

        audio = player;
        player.controls = true;
        player.preload = 'metadata';
        player.setAttribute('playsinline', '');
        player.setAttribute('aria-label', 'Player da música');

        /*
         * Necessário antes de definir src para que o áudio remoto
         * possa ser processado pelo Web Audio quando o servidor
         * permitir acesso CORS.
         */
        if (remote) {
            player.crossOrigin = 'anonymous';
            player.setAttribute('crossorigin', 'anonymous');
        }

        function on(event, callback) {
            player.addEventListener(event, function () {
                if (audio === player) {
                    callback();
                }
            });
        }

        function restorePosition() {
            if (pending <= 0) {
                return;
            }

            try {
                var target = pending;

                if (isFinite(player.duration)) {
                    target = Math.min(target, player.duration);
                }

                player.currentTime = target;
                pending = 0;
            } catch (ignoreSeek) {}
        }

        on('loadedmetadata', restorePosition);
        on('canplay', restorePosition);

        on('play', function () {
            if (el('youtube-player').firstChild) {
                closeYouTube();
            }

            resumeEffects(player);
        });

        on('playing', function () {
            say('Reproduzindo: ' + trackName);
        });

        on('pause', function () {
            if (!player.ended && !player.error) {
                say('Pausado: ' + trackName);
            }
        });

        on('waiting', function () {
            say('Carregando o áudio...');
        });

        on('ended', function () {
            say('Fim da música. Toque em Play para recomeçar.');
        });

        on('error', function () {
            var code = player.error ? player.error.code : 0;

            controls(false);
            el('restore').disabled = !eqOn;

            say(
                'Falha ao reproduzir (código ' + code + '). ' +
                'Escolha a música novamente. Se persistir, ' +
                'teste uma cópia em MP3.'
            );
        });

        player.src = mediaURL;
        el('player').appendChild(player);
        controls(true);
        player.load();
    }

    function playAudio() {
        if (!audio) {
            return;
        }

        var player = audio;

        if (el('youtube-player').firstChild) {
            closeYouTube();
        }

        say('Iniciando: ' + trackName);

        try {
            if (player.ended) {
                player.currentTime = 0;
            }

            resumeEffects(player);

            var result = player.play();

            if (result && result.then) {
                result.then(function () {}, function () {
                    if (audio === player) {
                        say('Toque no Play do controle de áudio para iniciar.');
                    }
                });
            }
        } catch (error) {
            say('Toque no Play do controle de áudio para iniciar.');
        }
    }

    function loadTrack(url, name, isRemote) {
        removePlayer();
        resetEQ();
        controls(false);
        releaseObjectURL();
        closeYouTube();

        mediaURL = url;
        trackName = name;
        remote = isRemote;

        if (!isRemote) {
            objectURL = url;
        }

        el('track-name').textContent = trackName;
        buildPlayer(0);
        say('Música carregada. Toque em Play.');
    }

    function restoreOriginal() {
        if (!audio) {
            return;
        }

        var position = audio.currentTime || 0;

        removePlayer();
        resetEQ();
        buildPlayer(position);

        say('Som original restaurado. Toque em Play para continuar.');
    }

    function updateEQ() {
        if (!eqOn || !outputNode) {
            return;
        }

        var i;
        var value;

        for (i = 0; i < profiles.length; i++) {
            value = parseFloat(el('eq-' + profiles[i].id).value);

            el('value-' + profiles[i].id).textContent =
                (value > 0 ? '+' : '') + value + ' dB';
        }

        for (i = 0; i < nodes.length; i++) {
            value = parseFloat(el('eq-' + nodes[i].id).value);
            nodes[i].node.gain.value = value * nodes[i].weight;
        }

        outputNode.gain.value = parseFloat(el('output').value) / 100;
        el('output-value').textContent = el('output').value + '%';
    }

    function activateEQ() {
        if (!audio || eqOn) {
            return;
        }

        var player = audio;
        var wasPlaying = !player.paused && !player.ended;

        try {
            var Context = window.AudioContext || window.webkitAudioContext;

            if (!Context) {
                throw new Error('Web Audio indisponível');
            }

            if (!ctx || ctx.state === 'closed') {
                ctx = new Context();
            }

            player.pause();

            outputNode = ctx.createGain();
            outputNode.gain.value = 1;
            outputNode.connect(ctx.destination);

            var previous = null;
            var i;
            var j;

            for (i = 0; i < profiles.length; i++) {
                for (j = 0; j < profiles[i].bands.length; j++) {
                    var band = profiles[i].bands[j];
                    var filter = ctx.createBiquadFilter();

                    filter.type = 'peaking';
                    filter.frequency.value = band[0];
                    filter.Q.value = band[1];
                    filter.gain.value = 0;

                    nodes.push({
                        node: filter,
                        id: profiles[i].id,
                        weight: band[2]
                    });

                    if (previous) {
                        previous.connect(filter);
                    }

                    previous = filter;
                }
            }

            previous.connect(outputNode);
            source = ctx.createMediaElementSource(player);
            source.connect(nodes[0].node);

            eqOn = true;
            resumeEffects(player);

            var silent = ctx.createBufferSource();
            silent.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
            silent.connect(ctx.destination);

            silent.onended = function () {
                try { silent.disconnect(); } catch (ignoreSilent) {}
            };

            silent.start(0);

            for (i = 0; i < profiles.length; i++) {
                el('eq-' + profiles[i].id).disabled = false;
            }

            el('output').disabled = false;
            controls(true);

            el('eq-status').textContent =
                'Realces ativados em zero. Ajuste os controles. ' +
                'Se ficar sem som, toque em Restaurar som original.';

            if (wasPlaying) {
                playAudio();
            }
        } catch (error) {
            restoreOriginal();

            el('eq-status').textContent =
                'Não foi possível ativar os realces neste dispositivo. ' +
                'O player voltou ao som original.';
        }
    }

    function jump(seconds) {
        if (!audio) {
            return;
        }

        if (audio.readyState < 1) {
            say('Aguarde o áudio carregar antes de avançar ou voltar.');
            return;
        }

        try {
            var target = Math.max(0, audio.currentTime + seconds);

            if (isFinite(audio.duration)) {
                target = Math.min(target, audio.duration);
            }

            audio.currentTime = target;
        } catch (error) {
            say('Não foi possível mudar a posição. Tente novamente.');
        }
    }

    function displayName(name) {
        return name.replace(/^\d{13}-/, '');
    }

    function setLibraryBusy(busy) {
        libraryBusy = busy;
        el('library-refresh').disabled = busy;
        el('library-more').disabled = busy;
    }

    function appendLibraryTrack(file, base) {
        if (!file || !file.name || !file.id) {
            return;
        }

        var button = document.createElement('button');
        var name = displayName(file.name);

        button.type = 'button';
        button.textContent = name;

        button.addEventListener('click', function () {
            var url = base +
                '/storage/v1/object/public/' +
                encodeURIComponent(cfg.bucket) + '/' +
                encodeURIComponent(file.name);

            loadTrack(url, name, true);
            el('library-panel').style.display = 'none';
            el('library-open').setAttribute('aria-expanded', 'false');
        });

        el('library-list').appendChild(button);
    }

    function loadLibrary(reset) {
        if (libraryBusy) {
            return;
        }

        if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !cfg.bucket) {
            el('library-status').textContent =
                'Não foi possível ler a configuração. Confira o config.js.';
            return;
        }

        if (reset) {
            libraryOffset = 0;
            libraryLoaded = false;
            el('library-list').innerHTML = '';
        }

        el('library-more').style.display = 'none';
        el('library-status').textContent = 'Carregando músicas...';
        setLibraryBusy(true);

        var base = cfg.supabaseUrl.replace(/\/$/, '');
        var request = new XMLHttpRequest();

        function fail(text) {
            setLibraryBusy(false);
            el('library-status').textContent = text;

            if (libraryOffset > 0) {
                el('library-more').style.display = 'inline-block';
            }
        }

        try {
            request.open(
                'POST',
                base + '/storage/v1/object/list/' +
                encodeURIComponent(cfg.bucket),
                true
            );

            request.timeout = 30000;
            request.setRequestHeader('apikey', cfg.supabaseAnonKey);
            request.setRequestHeader('Content-Type', 'application/json');

            /*
             * Chaves sb_publishable_ são enviadas em apikey.
             * Apenas a chave anon antiga, em formato JWT, vai em Bearer.
             */
            if (cfg.supabaseAnonKey.indexOf('eyJ') === 0) {
                request.setRequestHeader(
                    'Authorization',
                    'Bearer ' + cfg.supabaseAnonKey
                );
            }

            request.onload = function () {
                if (request.status < 200 || request.status >= 300) {
                    fail(
                        'Não foi possível carregar a biblioteca (' +
                        request.status + '). Toque em Atualizar lista.'
                    );
                    return;
                }

                var files;

                try {
                    files = JSON.parse(request.responseText);

                    if (Object.prototype.toString.call(files) !== '[object Array]') {
                        throw new Error('Resposta inesperada');
                    }
                } catch (error) {
                    fail('Resposta inválida. Toque em Atualizar lista.');
                    return;
                }

                for (var i = 0; i < files.length; i++) {
                    appendLibraryTrack(files[i], base);
                }

                libraryOffset += files.length;
                libraryLoaded = true;
                setLibraryBusy(false);

                el('library-more').style.display =
                    files.length === pageSize ? 'inline-block' : 'none';

                el('library-status').textContent =
                    el('library-list').children.length ?
                    'Escolha uma música abaixo.' :
                    'Nenhuma música encontrada. Envie uma pelo Safari.';
            };

            request.onerror = function () {
                fail('Falha de conexão. Confira a internet e atualize a lista.');
            };

            request.ontimeout = function () {
                fail('A conexão demorou demais. Toque em Atualizar lista.');
            };

            request.send(JSON.stringify({
                prefix: '',
                limit: pageSize,
                offset: libraryOffset,
                sortBy: {
                    column: 'name',
                    order: 'desc'
                }
            }));
        } catch (error) {
            fail('Não foi possível abrir a biblioteca. Confira o config.js.');
        }
    }

    function youtubeID(text) {
        var raw = text.replace(/^\s+|\s+$/g, '');

        if (!raw) {
            return null;
        }

        if (!/^https?:\/\//i.test(raw)) {
            raw = 'https://' + raw;
        }

        var link = document.createElement('a');
        link.href = raw;

        var host = link.hostname.toLowerCase();
        var id = '';
        var match;

        if (host === 'youtu.be') {
            id = link.pathname.split('/')[1];
        } else if (/^(www\.|m\.|music\.)?youtube\.com$/.test(host)) {
            match = link.search.match(/[?&]v=([A-Za-z0-9_-]{11})(?:&|$)/);

            if (!match) {
                match = link.pathname.match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})(?:\/|$)/);
            }

            if (match) {
                id = match[1];
            }
        }

        return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }

    el('library-open').addEventListener('click', function () {
        var panel = el('library-panel');
        var visible = panel.style.display === 'block';

        panel.style.display = visible ? 'none' : 'block';
        el('library-open').setAttribute(
            'aria-expanded',
            visible ? 'false' : 'true'
        );

        if (!visible && !libraryLoaded) {
            loadLibrary(true);
        }
    });

    el('library-refresh').addEventListener('click', function () {
        loadLibrary(true);
    });

    el('library-more').addEventListener('click', function () {
        loadLibrary(false);
    });

    el('file').addEventListener('change', function () {
        var file = this.files && this.files[0];

        if (!file) {
            return;
        }

        if (!file.size) {
            say('O arquivo está vazio ou ainda não foi baixado do iCloud.');
            this.value = '';
            return;
        }

        if (
            !/^audio\//i.test(file.type || '') &&
            !/\.(mp3|m4a|aac|wav|aif|aiff|mp4|ogg|flac)$/i.test(file.name || '')
        ) {
            say('Escolha um arquivo de música, como MP3 ou M4A.');
            this.value = '';
            return;
        }

        try {
            if (!urls || !urls.createObjectURL) {
                throw new Error('Arquivo indisponível');
            }

            var url = urls.createObjectURL(file);
            loadTrack(url, file.name || 'Música', false);
        } catch (error) {
            say('Não foi possível abrir esse arquivo.');
        }

        this.value = '';
    });

    el('play').addEventListener('click', function () {
        if (!audio) {
            return;
        }

        if (!audio.paused && !audio.ended) {
            audio.pause();
        } else {
            playAudio();
        }
    });

    el('stop').addEventListener('click', function () {
        if (!audio) {
            return;
        }

        audio.pause();

        try {
            audio.currentTime = 0;
            say('No início da música. Toque em Play.');
        } catch (error) {
            say('Aguarde a música carregar para voltar ao início.');
        }
    });

    el('back').addEventListener('click', function () {
        jump(-10);
    });

    el('forward').addEventListener('click', function () {
        jump(10);
    });

    el('activate').addEventListener('click', activateEQ);
    el('restore').addEventListener('click', restoreOriginal);
    el('output').addEventListener('input', updateEQ);
    el('output').addEventListener('change', updateEQ);

    el('youtube-open').addEventListener('click', function () {
        var id = youtubeID(el('youtube-url').value);

        if (!id) {
            el('youtube-status').textContent =
                'Cole um link válido de vídeo do YouTube.';
            return;
        }

        if (audio) {
            audio.pause();
        }

        closeYouTube();

        var frame = document.createElement('iframe');
        frame.title = 'Vídeo do YouTube';
        frame.setAttribute('allowfullscreen', '');
        frame.setAttribute('allow', 'encrypted-media; fullscreen');
        frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');

        frame.src = 'https://www.youtube.com/embed/' +
            id + '?playsinline=1&autoplay=0';

        el('youtube-player').appendChild(frame);
        el('youtube-link').href = 'https://www.youtube.com/watch?v=' + id;
        el('youtube-actions').style.display = 'block';

        el('youtube-status').textContent =
            'Toque no Play do vídeo. Se não abrir, use Abrir no YouTube.';
    });

    el('youtube-close').addEventListener('click', closeYouTube);

    createEQControls();
    resetEQ();
    controls(false);

    el('library-open').setAttribute('aria-expanded', 'false');

    /*
     * O seletor local fica disponível no navegador.
     * No modo aplicativo do iPad, usamos a biblioteca online.
     */
    if (!window.navigator.standalone) {
        el('local-panel').style.display = 'block';
    }

    say('Toque em Minhas músicas, escolha uma faixa e depois toque em Play.');
}());
