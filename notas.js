/* Bloco de notas do DrummApp — compatível com JavaScript ES5. */
(function () {
    'use strict';

    if (document.getElementById('drummapp-notes')) {
        return;
    }

    var player = document.getElementById('player');

    if (!player) {
        return;
    }

    var storageKey = 'drummapp-anotacoes-v1';
    var savedText = '';
    var storageAvailable = true;

    try {
        savedText = window.localStorage.getItem(storageKey) || '';
    } catch (error) {
        storageAvailable = false;
    }

    var container = document.createElement('div');
    container.id = 'drummapp-notes';
    container.style.marginTop = '24px';
    container.style.paddingTop = '16px';
    container.style.borderTop = '1px solid #738496';

    var title = document.createElement('h2');
    title.textContent = 'Bloco de notas';

    var description = document.createElement('p');
    description.className = 'note';
    description.textContent =
        'Anote enquanto escuta. Depois, copie o texto para o app Notas. ' +
        'Este é um bloco único para suas anotações.';

    var label = document.createElement('label');
    label.htmlFor = 'notes-text';
    label.textContent = 'Suas anotações';

    var textarea = document.createElement('textarea');
    textarea.id = 'notes-text';
    textarea.rows = 10;
    textarea.placeholder =
        'Exemplo:\nNome da música\n0:35 — entrada da bateria\n1:12 — virada';
    textarea.value = savedText;
    textarea.style.display = 'block';
    textarea.style.width = '100%';
    textarea.style.minHeight = '220px';
    textarea.style.padding = '14px';
    textarea.style.fontSize = '17px';
    textarea.style.lineHeight = '1.5';
    textarea.style.fontFamily = 'Arial, sans-serif';
    textarea.style.border = '1px solid #8294a5';
    textarea.style.borderRadius = '8px';
    textarea.style.background = '#ffffff';
    textarea.style.color = '#172b3a';
    textarea.style.boxSizing = 'border-box';

    var copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.textContent = 'Copiar anotações';

    var selectButton = document.createElement('button');
    selectButton.type = 'button';
    selectButton.textContent = 'Selecionar tudo';

    var feedback = document.createElement('p');
    feedback.className = 'note';
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');

    var warning = document.createElement('p');
    warning.className = 'note';
    warning.textContent =
        'As notas ficam neste navegador/dispositivo e podem ser perdidas ' +
        'se os dados do site forem apagados. Copie o texto para o app Notas ' +
        'ao terminar. Elas não são sincronizadas entre Safari e aplicativo.';

    container.appendChild(title);
    container.appendChild(description);
    container.appendChild(label);
    container.appendChild(textarea);
    container.appendChild(copyButton);
    container.appendChild(selectButton);
    container.appendChild(feedback);
    container.appendChild(warning);

    /*
     * Insere abaixo dos controles do player, antes dos realces.
     */
    var playerSection = player.parentNode;

    if (
        playerSection &&
        playerSection.tagName.toLowerCase() === 'section'
    ) {
        playerSection.appendChild(container);
    } else {
        player.parentNode.insertBefore(container, player.nextSibling);
    }

    function saveNotes() {
        try {
            window.localStorage.setItem(storageKey, textarea.value);
            storageAvailable = true;
            feedback.textContent = 'Anotações salvas neste navegador.';
        } catch (error) {
            storageAvailable = false;
            feedback.textContent =
                'Não foi possível salvar automaticamente. ' +
                'Copie suas anotações antes de sair.';
        }
    }

    function selectAll() {
        textarea.focus();
        textarea.select();

        try {
            textarea.setSelectionRange(0, textarea.value.length);
        } catch (ignoreSelection) {}
    }

    textarea.addEventListener('input', saveNotes);
    textarea.addEventListener('change', saveNotes);

    window.addEventListener('pagehide', function () {
        saveNotes();
    });

    selectButton.addEventListener('click', function () {
        if (!textarea.value) {
            feedback.textContent = 'Escreva uma anotação primeiro.';
            return;
        }

        selectAll();

        feedback.textContent =
            'Texto selecionado. Toque em Copiar no menu do iPad. ' +
            'Se o menu não aparecer, toque e segure sobre o texto.';
    });

    copyButton.addEventListener('click', function () {
        if (!textarea.value) {
            feedback.textContent = 'Escreva uma anotação primeiro.';
            return;
        }

        saveNotes();
        selectAll();

        var copied = false;

        try {
            copied = document.execCommand('copy');
        } catch (ignoreCopy) {}

        if (copied) {
            feedback.textContent =
                'Texto copiado! Abra o app Notas, toque e segure e escolha Colar.';
        } else {
            feedback.textContent =
                'Este iPad não permitiu a cópia automática. ' +
                'O texto está selecionado: toque e segure e escolha Copiar.';
        }
    });

    feedback.textContent = storageAvailable ?
        (savedText ?
            'Suas anotações anteriores foram recuperadas.' :
            'O texto será salvo automaticamente enquanto você escreve.') :
        'O salvamento automático está indisponível. Copie antes de sair.';
}());
