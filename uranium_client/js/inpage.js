
window.onload = function () {
    let isMainWindow = false;
    try {
        isMainWindow = (window.self !== window.top) == false ? true : false;
    } catch (e) { isMainWindow = false; }

    if (isMainWindow) {
        // $('<h1>' + isMainWindow + '</h1>').insertBefore($('body>*').eq(0));
        count_loop = 0;
        window.loopFindRecaptcha = setInterval(() => {
            count_loop += 1;
            let captchaClient = findRecaptchaClients()
            $('body').attr('captcha_count', captchaClient.length).attr('step', count_loop)
            if (captchaClient && captchaClient != undefined && captchaClient.length > 0 && captchaClient[0].version == "V2") {
                console.log(captchaClient);
                reCaptchaCallback = captchaClient[0]['function'];
                let embed = `
                <div id="cs-recaptcha-control">
                    <button id="cs-solve-recaptcha" status="not_yet">Solve reCaptcha</button>
                </div>`
                if ($('#cs-recaptcha-control').length == 0) {
                    $('body').append(embed);
                }
                solveCaptchaHandle();
                $(document).on('click', '#cs-solve-recaptcha', solveCaptchaHandle);
                clearInterval(window.loopFindRecaptcha);
            }
        }, 200);
    }
}
