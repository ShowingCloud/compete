// Initialize the app
var myApp = new Framework7();

// Export selectors engine
var $$ = Dom7;

// Add view
var mainView = myApp.addView('.view-main', {
    animatePages: false //disable animated transitions between pages
});

//Initialize PouchDB
var scoreDB = new PouchDB("score", {
    adapter: 'websql'
    , location: 2
});
var msgDB = new PouchDB("msg", {
    adapter: 'websql'
    , location: 2
});
//Not use remote PouchDb server
var remoteCouch = false;

// apption for app
var appOption = {
    serverHost: "http://dev.domelab.com"
};

if (!HTMLCanvasElement.prototype.toBlob) {
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
        value: function (callback, type, quality) {

            var binStr = atob(this.toDataURL(type, quality).split(',')[1])
                , len = binStr.length
                , arr = new Uint8Array(len);

            for (var i = 0; i < len; i++) {
                arr[i] = binStr.charCodeAt(i);
            }

            callback(new Blob([arr], {
                type: type || 'image/png'
            }));
        }
    });
}

var temp = {
    compete: {}
    , event: {}
    , schedule_name: "初赛"
    , kind: 1
    , th: 1
    , team1_id: 0
    , team2_id: 0
};

var judgeInfo = {};

var app = {
    init: function () {
        //Globle ajax error handller
        $$(document).on('ajaxError', function (e) {
            var xhr = e.detail.xhr;
            console.log(xhr);
            if (xhr.status === 401) {
                myApp.alert("登陆失效，请重新登陆", "");
                localStorage.removeItem("judgeInfo");
                MessageBus.stop();
                $$("#judge-info").hide();
                $$("#login-container").show();
                app.login();
            }
        });
        app.getProcess();
        //Check local judge data exciting
        var tempStr;
        tempStr = localStorage.getItem("judgeInfo");
        if (typeof (tempStr) === "string") {
            judgeInfo = JSON.parse(tempStr);
            app.showJudge(judgeInfo);
            app.onLogin(judgeInfo.authToken);
        } else {
            app.login();
        }

        $$("#asideBar a").on("click", function (e) {
            var href = $$(this).data("href");
            if (mainView.activePage.name === "stopWatch") {
                if (href !== "stopWatch.html") {
                    myApp.confirm("是否放弃本次记分？", "", function (goto) {
                        mainView.router.loadPage(href);
                    });
                }
            } else {
                mainView.router.loadPage(href);
            }
        });

    }
    , login: function () {
        $$("#login-btn").off('click');
        String.prototype.getParam = function (str) {
                str = str.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
                var regex = new RegExp("[\\?&]*" + str + "=([^&#]*)");
                var results = regex.exec(this);
                if (results == null) {
                    return "";
                } else {
                    return results[1];
                }
            }
            //Oauth2 job 
        document.addEventListener("deviceready", function () {
            var options = {
                auth_url: 'http://dev.domelab.com/auth/login/authorize'
                , token_url: 'http://dev.domelab.com/auth/login/access_token'
                , client_id: '1'
                , client_secret: '123456'
                , redirect_uri: 'http://dev.domelab.com'
            }

            //Generate Login URL
            var paramObj = {
                client_id: options.client_id
                , redirect_uri: options.redirect_uri
                , response_type: options.response_type
            };
            var login_url = options.auth_url + '?' + $$.serializeObject(paramObj);
            //Open an inappbrowser but not show it to user
            var ref = window.open(login_url, "_blank", "hidden=yes,clearcache=yes");
            var count = 0;
            ref.addEventListener('loadstart', function (e) {
                var url = e.url;
                url = url.split("#")[0];

                var code = url.getParam("code");
                if (code) {
                    ref.close();
                    //Get access token
                    $$.ajax({
                        url: options.token_url
                        , data: {
                            code: code
                            , client_id: options.client_id
                            , client_secret: options.client_secret
                            , redirect_uri: options.redirect_uri
                            , grant_type: "authorization_code"
                        }
                        , method: 'POST'
                        , success: function (data) {
                            //Get userInfo
                            var dataObj = JSON.parse(data);
                            $$.getJSON('http://dev.domelab.com/auth/login/user', {
                                oauth_token: dataObj.access_token
                            }, function (d) {
                                console.log(d);
                                if ((d instanceof Object)) {
                                    var judgeInfo = {
                                        userId: d.id
                                        , email: d.info.email
                                        , nickname: d.extra.nickname
                                        , authToken: d.info.private_token
                                    };
                                    localStorage.setItem("judgeInfo", JSON.stringify(judgeInfo));
                                    console.log('userInfo saved!');
                                    app.showJudge(judgeInfo);
                                    app.onLogin(judgeInfo.authToken);

                                }
                            });
                        }
                        , error: function (error) {
                            console.log(error);
                        }
                    });
                }
            });
            ref.addEventListener('loadstop', function (e) {
                if (e.url === "http://dev.domelab.com/account/sign_in") {
                    if (!count) {
                        count++;
                        myApp.alert("请登录", "");
                        $$("#login-btn").on('click', function () {
                            var username = $$("#username").val();
                            var password = $$("#password").val();
                            if (typeof username === "string" && typeof password === "string") {
                                //Inject script to inappbrowser to submit the login form
                                var script = "document.getElementsByName('user[login]')[0].value='" + username + "';" + "document.getElementsByName('user[password]')[0].value='" + password + "';" + "document.getElementById('new_user').submit();"
                                ref.executeScript({
                                    code: script
                                }, function (values) {
                                    console.log(values);
                                });
                            } else {
                                myApp.alert("请输入用户名和密码", "");
                            }
                        });
                    } else {
                        myApp.alert("错误，请重新登录", "");
                    }
                }

            });

        });
    }
    , bind: function () {


    }
    , onLogin: function (token) {
        //get realtime message
        app.getMessage(token);
        //logout
        $$("#logout-btn").on("click", function (token) {
            var channel = "/channel/" + token;
            localStorage.removeItem("judgeInfo");
            MessageBus.unsubscribe(channel, function () {
                console("unsubscribe");
            });
            MessageBus.stop();
            $$("#judge-info").hide();
            $$("#login-container").show();
            app.login();
        });

        myApp.onPageInit('player', function (page) {
            $$("#getPlyaer").off("click").on("click", function () {
                var playerId = $$("#playerId").val();
                if (playerId) {
                    var url = "http://dev.domelab.com/api/v1/users/" + token + "/team_players";
                    $$.getJSON(url, {
                        identifier: playerId
                    }, function (data) {
                        console.log(data);
                        if (!data.result[0]) {
                            if (typeof data.result[1] === "string")
                                myApp.alert(data.result[1], "");
                            return;
                        } else {
                            var team = data.result[1][0];
                            temp.player = {
                                name: team.team_name
                                , code: $$("#playerId").val()
                            };
                            var player = team;
                            var template, compiledTemp;
                            player.eventName = temp.compete.name + "-" + temp.event.name;
                            player.playCode = $$("#playerId").val();
                            console.log(player);
                            if (team.user.length === 1) {
                                template = $$('#playerTemp').html();
                            } else {
                                template = $$('#teamTemp').html();
                            }

                            compiledTemp = Template7.compile(template);

                            temp.playerInfo = compiledTemp(player);
                            console.log(temp);
                            mainView.router.loadPage('stopWatch.html');
                        }
                    });
                } else {
                    myApp.alert("请输入选手编号", "");
                }
            });
        });
    }
    , showJudge: function (judge) {
        console.log(judge);
        $$("#judgeId").text(judge.userId);
        $$("#judgeName").text(judge.nickname);
        $$("#login-container").hide();
        $$("#judge-info").show();
    }
    , getProcess: function () {
        $$.getJSON("http://dev.domelab.com/api/v1/competitions", function (process) {
            console.log(process);
            var processTemp = $$('#processTemp').html();
            var compiledTemp = Template7.compile(processTemp);
            var html = compiledTemp(process);
            $$("#homePage .page-content").append(html);
        });
    }
    , getResponse: function () {
        $$.getJSON("./data/response.json", function (response) {
            $$("#judgeComptition").val(response.compition);
            $$("#judgeEvent").val(response.events.toString());
        });
    }
    , getMessage: function (token) {
        //Get unread counts
        $$.getJSON("http://dev.domelab.com/api/v1/users/" + token + "/notifications/unread ", function (unread) {
            console.log(unread);
            $$("#msg").addClass("newMsg");
        });
        //Subscribe message
        var channel = "/channel/" + token;
        MessageBus.start();
        MessageBus.callbackInterval = 500;
        MessageBus.subscribe(channel, function (d) {
            console.log(d);
            myApp.addNotification({
                title: '重要通知'
                , message: d.content
            });
            msgDB.post(d).then(function (response) {
                console.log(response);
            }).catch(function (err) {
                console.log(err);
            });;
            // $$("#msgBoard ul").append("<li><p class='time'>" + d.time + "</p><p class='content'>" +
            //     d.content + "</p></li>");
            $$("#msg").addClass("newMsg");
        });

    }
    , takePhoto: function (limit) {
        var photoSuccess = function (mediaFiles) {
            var i, path, len;
            for (i = 0, len = mediaFiles.length; i < len; i += 1) {
                path = mediaFiles[i].fullPath;
                console.log(path);
                $$("#photos").append('<img scr="' + path + '">');
            }
        };

        // capture error callback
        var photoError = function (error) {
            myApp.alert('Error code: ' + error.code, null, 'Capture Error');
        };

        // start image capture
        navigator.device.capture.captureImage(photoSuccess, photoError, {
            limit: limit
        });
    }
    , takeVideo: function () {
        // capture callback
        var videoSuccess = function (mediaFiles) {

            var path = mediaFiles[0].fullPath;
            var type = mediaFiles[0].type;
            myApp.alert("This is a " + type + " file,path:" + path);
            var v = "<video controls='controls'>";
            v += "<source src='" + path + "' type='" + type + "'>";
            v += "</video>";
            $$("video").append(v);
        };

        // capture error callback
        var videoError = function (error) {
            myApp.alert('Error code: ' + error.code, null, 'Capture Error');
        };

        // start video capture
        navigator.device.capture.captureVideo(videoSuccess, videoError, {
            limit: 1
            , duration: 300
        });
    }
    , submitScore: function (drawed) {
        var scoreData = {
            _attachments: {}
            , score1: {}
            , score2: {}
        };
        var remark;
        //Get score1
        $$(".score").each(function (i, obj) {
            var _this = $$(this);
            var value = _this.val();
            var name = _this.attr('name');
            if (value) {
                scoreData.score1[name] = value;
                console.log(scoreData.score1[name]);
            }
        });

        if (Object.keys(scoreData.score1).length < $$(".score").length) {
            myApp.alert("分数未填写完整", "");
            return;
        }

        if (!drawed) {
            myApp.alert("你还没有签名", "");
            return;
        }
        //Get remark
        remark = $$("#remarkInput").val();
        if (remark) {
            scoreData.remark = remark;
        }
        //Get signature
        var CanvasElement = document.getElementById("canvas");

        CanvasElement.toBlob(function (blob) {
            var signature = {
                content_type: "image/jpeg"
                , data: blob
            };
            scoreData._attachments.signature = signature;
        }, "image/jpeg", 0.95);
        scoreData._id = new Date().toISOString();
        scoreData.player = temp.player;
        scoreData.judgeid = judgeInfo.userId;
        scoreData.event = temp.event;
        scoreData.compete = temp.compete;
        scoreData.schedule_name = temp.schedule_name;
        scoreData.kind = temp.kind;
        scoreData.th = temp.th;
        scoreData.upload = false;
        scoreDB.put(scoreData).then(function (response) {
            app.uploadScore(response.id, function () {
                myApp.hidePreloader();
                myApp.alert("成绩已上传", "", function () {
                    mainView.router.back();
                });
            });
        }).catch(function (err) {
            console.log(err);
        });
    }
    , uploadScore: function (doc_id, success) {
        scoreDB.get(doc_id, {
            attachments: true
            , binary: true
        }).then(function (doc) {
            var toPost = {
                event_id: doc.event.id
                , schedule_name: doc.schedule_name
                , kind: doc.kind
                , th: doc.th
                , team1_id: doc.player.code, // team2_id:doc.player.id,
                score1: doc.score1
                , note: doc.remark || ""
                , confirm_sign: doc._attachments.signature.data
            };
            console.log(toPost);
            var form_data = new FormData();

            for (var key in toPost) {
                if (key === "score1") {
                    for (var key1 in toPost.score1) {
                        form_data.append("score1" + "[" + key1 + "]", toPost[key][key1]);
                    }
                } else {
                    form_data.append(key, toPost[key]);
                }

            }

            $$.ajax({
                method: "POST"
                , url: "http://dev.domelab.com/api/v1/scores/" + judgeInfo.authToken + "/score"
                , contentType: "multipart/form-data"
                , data: form_data
                , dataType: "json"
                , success: function (response) {
                    console.log(response);
                    doc.upload = "Yes";
                    return scoreDB.put(doc);
                }
                , error: function (error) {
                    console.log(error);
                }
            });

        }).then(function (response) {
            if (typeof success === "function") {
                success();
            }
        }).catch(function (err) {
            console.log(err);
        });
    }
};

myApp.onPageBeforeInit('home', function (page) {
    app.showJudge(judgeInfo);
    app.getProcess();
    console.log(page);
});

myApp.onPageBeforeRemove('home', function (page) {
    console.log("remove home");
});

myApp.onPageInit('select', function (page) {
    $$("#eventsBoard .tab div").on("click", function () {
        var compete = {
            id: $$(".compete-select .active").data("id")
            , name: $$(".compete-select .active").text()
        };
        var event = {
            id: $$(this).data("id")
            , name: $$(this).text()
        }
        temp.compete = compete;
        temp.event = event;
        mainView.router.loadPage('player.html');
    });
});

myApp.onPageInit('msg', function (page) {
    $$("#msg").removeClass("newMsg");
});

myApp.onPageInit('data', function (page) {
    function formatDate(d) {
        var myDate = new Date(d);
        var dateStr = (myDate.getMonth() + 1) + "/" + myDate.getDate() + "/" + myDate.getFullYear();
        var timeStr = myDate.toTimeString().substr(0, 5);
        return timeStr + "  " + dateStr;
    }
    var toUpload = [];
    var compid = [];
    var length = 0;
    scoreDB.allDocs({
        include_docs: true
        , attachments: false
    }).then(function (result) {
        console.log(result);
        var template = $$("#data-item").html();
        var compiledTemp = Template7.compile(template);
        result.rows.forEach(function (element, index) {
            console.log(element);
            var doc = element.doc;
            //ToDo render score items
            if (!doc.upload) {
                toUpload.push(doc._id);
            }
            var id = doc.compete.id;
            if (!compid.includes(id)) {
                compid.push(id);
                $$(".data-tabbar").append('<a href="#dataTab' + id + '" class="tab-link">' + doc.compete.name + '</a>');
                $$(".data-tabs").append('<ul class="tab active" id="dataTab' + id + '"></ul>');
            }
            var num = (index + 1).toString();
            var pad = "00";
            if (num.length < 3) {
                num = pad.substr(0, 3 - num.length) + num;
            }
            doc.index = num;
            doc.date = formatDate(doc._id);
            var html = compiledTemp(doc);
            $$("#dataTab" + id).append(html);

        });
        length = toUpload.length;
        $$("#notUploaded").text(length);
        $$(".upload-all").on("click", function () {
            if (length) {
                console.log(toUpload);
                var newLength = length;

                function success() {
                    if (newLength > 0) {
                        if (newLength === 1) {
                            myApp.hidePreloader();
                            mainView.router.loadPage('Uploaded.html');
                        } else {
                            newLength--;
                        }
                    }
                }
                myApp.showPreloader("正在上传");
                toUpload.forEach(function (i) {
                    app.uploadScore(i, success);
                });

            }
        });
        console.log(toUpload);

    }).catch(function (err) {
        console.log(err);
    });
});

myApp.onPageInit('stopWatch', function (page) {

    $$("#takePhoto").on("click", function () {
        var quantity = $$("#photo img").length;
        if (quantity === 3) {
            myApp.alert("最多拍三张照片", "");
        } else {
            app.takePhoto(3 - quantity);
        }
    });

    $$("#takeVideo").on("click", function () {
        if ($$("#video video").length) {
            myApp.confirm("是否重新拍摄视频，弃用之前的视频", function () {
                $$("#video").html("");
                app.takeVideo();
            });
        } else {
            app.takeVideo();
        }

    });
    var drawed = 0;

    if (temp.playerInfo) {
        $$(".playerInfo").append(temp.playerInfo);
        var mySwiper = myApp.swiper('.swiper-container', {
            pagination: '.swiper-pagination'
            , paginationHide: false
            , paginationClickable: true
        });
    }

    $$("#submitScore").on("click", function () {
        app.submitScore(drawed);
    });


    var Stopwatch = function () {
        var startAt = 0;
        var lapTime = 0;

        var now = function () {
            return (new Date()).getTime();
        };

        this.start = function () {
            startAt = startAt ? startAt : now();
        };

        this.stop = function () {
            lapTime = startAt ? lapTime + now() - startAt : lapTime;
            startAt = 0;
        };

        this.reset = function () {
            lapTime = startAt = 0;
        };

        this.time = function () {
            return lapTime + (startAt ? now() - startAt : 0);
        };
    };
    var x = new Stopwatch();
    var $time;
    var clocktimer;
    var total;
    var timeLimit = 5000;

    var timeoutHander = function () {
        myApp.alert("已超时", "");
    };

    function pad(num, size) {
        var a = num;
        if (a.toString().length > size) {
            return a.toString().substring(0, size);
        } else {
            var s = "0000" + num;
            return s.substr(s.length - size);
        }

    }

    function formatTime(time) {
        var h = m = s = ms = 0;
        var newTime = '';

        time = time % (60 * 60 * 1000);
        m = Math.floor(time / (60 * 1000));
        time = time % (60 * 1000);
        s = Math.floor(time / 1000);
        ms = time % 1000;

        newTime = pad(m, 2) + ':' + pad(s, 2) + ':' + pad(ms, 2);
        return newTime;
    }

    function show() {
        $time = document.getElementById('time');
        update();
    }

    function update() {
        var timeNow = x.time();

        if (timeNow >= timeLimit) {
            stop();
            $time.innerHTML = formatTime(timeLimit);
            timeoutHander();
        } else {
            $time.innerHTML = formatTime(timeNow);
        }
    }

    function start() {
        clocktimer = setInterval(update, 1);
        x.start();
        $$("#start").text("停止");
        document.getElementById('start').onclick = stop;
    }

    function stop() {
        x.stop();
        clearInterval(clocktimer);
        document.getElementById('start').onclick = start;
        $$("#start").text("开始");
    }

    function reset() {
        stop();
        x.reset();
        update();
    }

    function record() {
        stop();
        var elements = document.getElementsByClassName("timeScore");
        for (var i = 0; i < elements.length; i++) {
            if (!elements[i].value && $time.innerHTML !== "00:00:00") {
                elements[i].value = $time.innerHTML;
                if (i === elements.length - 1) {
                    reset();
                    document.getElementById('start').onclick = document.getElementById('reset').onclick = document.getElementById('record').onclick = null;

                    total = 0;
                    for (var i = 0; i < elements.length; i++) {
                        total = total + unformat(elements[i].value);
                    }
                    console.log(total);
                    document.getElementById('finalScore').value = formatTime(total);
                }
                break;
            }
        }
        x.reset();
    }

    function unformat(data) {
        var a = data.split(":");
        return a[0] * 60 * 1000 + a[1] * 1000 + a[2] * 10;
    }

    show();

    document.getElementById('start').onclick = start;
    document.getElementById('reset').onclick = reset;
    document.getElementById('record').onclick = record;


    var canvas = document.getElementById('canvas');
    var context = canvas.getContext("2d");
    canvas.addEventListener("touchstart", touchStartHandler, false);
    canvas.addEventListener("touchmove", touchMoveHandler, false);
    canvas.addEventListener("touchend", touchEndHandler, false);
    document.getElementById("clearCanvas").onclick = function () {
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        clickX = [];
        clickY = [];
        clickDrag = [];
    };

    function touchStartHandler(e) {
        e.preventDefault();
        var touchEvent = e.changedTouches[0];
        paint = true;
        addClick(touchEvent.clientX - $$("#canvas").offset().left, touchEvent.clientY - $$("#canvas").offset().top);
        redraw();
    }

    function touchMoveHandler(e) {
        e.preventDefault();
        var touchEvent = e.changedTouches[0];
        if (paint) {
            addClick(touchEvent.clientX - $$("#canvas").offset().left, touchEvent.clientY - $$("#canvas").offset().top, true);
            redraw();
        }
        drawed++;
    }

    function touchEndHandler(e) {
        e.preventDefault();
        paint = false;
    }

    var clickX = [];
    var clickY = [];
    var clickDrag = [];
    var paint;

    function addClick(x, y, dragging) {
        clickX.push(x);
        clickY.push(y);
        clickDrag.push(dragging);
    }

    function redraw() {
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);

        context.strokeStyle = "#D7E4F4";
        context.lineJoin = "round";
        context.lineWidth = 3;

        for (var i = 0; i < clickX.length; i++) {
            context.beginPath();
            if (clickDrag[i] && i) {
                context.moveTo(clickX[i - 1], clickY[i - 1]);
            } else {
                context.moveTo(clickX[i] - 1, clickY[i]);
            }
            context.lineTo(clickX[i], clickY[i]);
            context.closePath();
            context.stroke();
        }
    }


});

app.init();