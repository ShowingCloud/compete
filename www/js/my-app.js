// "use strict";
// Initialize the app
var myApp = new Framework7({
    tapHold: true
});

var uuid;

// Export selectors engine
var $$ = Dom7;

// Add view
var mainView = myApp.addView('.view-main', {
    animatePages: false //disable animated transitions between pages
});

//Initialize PouchDB
var scoreDB = new PouchDB("score", {
    adapter: 'websql'
});
var msgDB = new PouchDB("msg", {
    adapter: 'websql'
});
//Not use remote PouchDb server
var remoteCouch = false;

// apption for app
var appOption = {
    serverHost: "http://dev.domelab.com"
};

var scoreAttr = [{
    name: "第一次",
    type: "a2"
}, {
    name: "第二次",
    type: "a2"
}, {
    name: "总分",
    type: "b1"
}];

if (!HTMLCanvasElement.prototype.toBlob) {
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
        value: function(callback, type, quality) {

            var binStr = atob(this.toDataURL(type, quality).split(',')[1]),
                len = binStr.length,
                arr = new Uint8Array(len);

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
    compete: {
        id: 1,
        name: "机械奥运"
    },
    event: {
        id: 1,
        name: "机器人短跑",
        time_limit: 20
    },
    schedule_name: "初赛",
    kind: 1,
    th: 1,
    team1_id: 0,
    team2_id: 0
};

var judgeInfo = {};

function arrayToBytes(array) {
    var newArray = new Uint8Array(array.length);
    for (var i = 0, l = array.length; i < l; i++) {
        newArray[i] = parseInt(array[i], 10);
    }
    return newArray.buffer;
}

function printData(byteArrayData) {
    var hex = [],
        h, x, len = byteArrayData.length;


    for (var i = 0; i < len; i++) {
        x = byteArrayData[i];
        h = x.toString(16);
        if (x < 16) h = "0" + h;
        hex.push(h);
    }
    return hex.join(' ');
}

var track = {
    formatTime: function(time) {
        function pad(num, size) {
            var a = num;
            if (a.toString().length > size) {
                return a.toString().substring(0, size);
            } else {
                var s = "0000" + num;
                return s.substr(s.length - size);
            }

        }
        var h = m = s = ms = 0;
        var newTime = '';

        time = time % (60 * 60 * 1000);
        m = Math.floor(time / (60 * 1000));
        time = time % (60 * 1000);
        s = Math.floor(time / 1000);
        ms = time % 1000;

        newTime = pad(m, 2) + ':' + pad(s, 2) + ':' + pad(ms, 2);
        return newTime;
    },
    unformat: function(data) {
        var a = data.split(":");
        return a[0] * 60 * 1000 + a[1] * 1000 + a[2] * 10;
    },
    status: {
        find: 0,
        playing: 0,
        score: 0
    },
    arrayToBytes: function(array) {
        var newArray = new Uint8Array(array.length);
        for (var i = 0, l = array.length; i < l; i++) {
            newArray[i] = parseInt(array[i], 10);
        }
        return newArray.buffer;
    },
    printData: function(byteArrayData) {
        var hex = [],
            h, x, len = byteArrayData.length;
        for (var i = 0; i < len; i++) {
            x = byteArrayData[i];
            h = x.toString(16);
            if (x < 16) h = "0" + h;
            hex.push(h);
        }
        return hex.join(' ');
    },
    service: {
        deviceId: "",
        serviceUUID: "6e400005-b5a3-f393-e0a9-e50e24dcca9e", //蓝牙服务UUID
        txCharacteristic: "6e400006-b5a3-f393-e0a9-e50e24dcca9e", // 蓝牙tx UUID
        rxCharacteristic: "6e400007-b5a3-f393-e0a9-e50e24dcca9e" // 蓝牙rx UUID
    },
    scan: function() {
        myApp.showPreloader("正在搜寻赛道，请靠近赛道");
        track.status.find = 0;
        ble.startScan([track.service.serviceUUID], track.onDiscoverDevice, app.onError);
        setTimeout(function() {

            if (!track.status.find) {
                window.plugins.toast.showShortCenter("未找到赛道");
                myApp.hidePreloader();
                ble.stopScan(function() {
                    console.log("Scan complete")
                }, function() {
                    console.log("stopScan failed")
                });
            }
        }, 10000);
    },
    onDiscoverDevice: function(device) {
        myApp.hidePreloader();
        window.plugins.toast.showShortCenter("已找到赛道");
        ble.stopScan(function() {
            console.log("Scan complete");
            console.log(device);
            track.connect(device.id);
            track.status.find = 1;
        }, function() {
            console.log("stopScan failed")
        });

    },
    connect: function(deviceId) {
        var onConnect = function() {
            window.plugins.toast.showShortCenter("已连接赛道");
            ble.startNotification(deviceId, track.service.serviceUUID, track.service.rxCharacteristic, track.onData, track.onError);
            track.service.deviceId = deviceId;
            track.sendOrder();
        };
        ble.connect(deviceId, onConnect, function() {
            myApp.alert("连接赛道失败，请重试", "");
        });
    },
    onData: function(data) {
        var d = new Uint8Array(data);
        var dataStr = track.printData(d);
        console.log(dataStr);
        var step = d[1];
        if (d[0] === 170) {
            switch (step) {
                case 2:
                    window.plugins.toast.showShortCenter("闸门已打开");
                    track.status.playing = 1;
                    break;
                case 5:
                    track.reset();
                    var time = d[5] + d[4] * 256 + d[3] * 256 * 256 + d[2] * 256 * 256 * 256;
                    console.log(time);
                    if (time > temp.event.limit * 1000) {
                        myApp.alert("已超时：" + track.formatTime(time) + "秒", "");
                        racke.render(temp.event.limit * 1000);
                    } else {
                        track.render(time);
                    }

                    break;
                case 3:
                    window.plugins.toast.showShortCenter("信息错误");
                    break;
            }
        } else {
            myApp.alert("收到奇怪的数据:" + dataStr, "");
        }
    },
    raceUp: function() {
        track.order = [170, 1, 0, 0, 255];
        track.status.sending = "raceUp";
        track.init();
    },
    getScore: function() {
        track.order = [170, 4, 0, 0, 255];
        track.status.sending = "getScore";
        track.init();
    },
    openDoor: function() {
        track.order = [170, 7, 0, 0, 255];
        track.status.sending = "openDoor";
        track.init();
    },
    closeDoor: function() {
        track.order = [170, 8, 0, 0, 255];
        track.status.sending = "closeDoor";
        track.init();
    },
    reset: function() {
        track.status.playing = null;
        track.order = [170, 6, 0, 0, 255];
        track.status.sending = "reset";
        track.init();
    },
    sendOrder: function() {
        if (track.order) {
            var data = track.arrayToBytes(track.order);
            ble.write(track.service.deviceId, track.service.serviceUUID, track.service.txCharacteristic, data, function() {
                console.log(track.status.sending + " send success");
                window.plugins.toast.showShortCenter("已发送指令");
                track.order = null;
            }, function() {
                console.log(track.status.sending + " send failed");
                myApp.alert("指令发送失败请重试");
            });
        }

    },
    disconnect: function() {
        ble.disconnect(deviceId, function() {
            window.plugins.toast.showShortCenter("已断开");
            track.order = null;
        }, function() {
            window.plugins.toast.showShortCenter("蓝牙未能断开");
        });
    },
    errorConnect: function(error) {
        if (error) {
            console.log(error);
        }
        if (track.status.playing) {
            myApp.alert("蓝牙断开，请重新连上赛道，读取分数", "", function() {
                track.getScore();
            });
        }
    },
    onError: function(reason) {
        myApp.alert(reason, "");
        track.order = null;
    },
    init: function() {
        ble.isEnabled(
            function() {
                if (track.service.deviceId) {
                    ble.isConnected(track.service.deviceId, function() {
                        track.sendOrder();
                    }, function() {
                        track.scan();
                    });
                } else {
                    track.scan();
                }
            },
            function() {
                myApp.alert("请打开蓝牙后重试", "", function() {
                    track.init()
                });
            }
        );
    },
    check: function() {
        myApp.modal({
            title: '',
            text: '请至赛道5米范围内，连接赛道',
            buttons: [{
                text: '连接',
                onClick: function() {
                    track.init();
                }
            }]
        });
    },
    render: function(time) {
        var elements = document.getElementsByClassName("track-score");
        for (var i = 0; i < elements.length; i++) {
            if (!elements[i].value) {
                elements[i].value = track.formatTime(time);
                if (i === elements.length - 1) {
                    total = 0;
                    for (var i = 0; i < elements.length; i++) {
                        total = total + track.unformat(elements[i].value);
                    }
                    console.log(total);
                    document.querySelector('.final-score').value = track.formatTime(total);
                }
                break;
            }
        }
    }
}

var app = {
    init: function() {
        app.bind();
        app.getProcess();
        //Check local judge data exciting
        var tempStr;
        tempStr = localStorage.getItem("judgeInfo");
        if (typeof(tempStr) === "string") {
            judgeInfo = JSON.parse(tempStr);
            app.showJudge(judgeInfo);
            app.onLogin(judgeInfo.authToken);
        } else {
            $$("#login-container").show();
            app.login();
        }

        $$("#asideBar a").on("click", function(e) {
            var href = $$(this).data("href");
            if (mainView.activePage.name === "stopWatch") {
                if (href !== "stopWatch.html") {
                    myApp.confirm("是否放弃本次记分？", "", function(goto) {
                        mainView.router.loadPage(href);
                    });
                }
            } else {
                mainView.router.loadPage(href);
            }
        });
    },
    login: function() {
        $$("#login-btn").off('click');
        String.prototype.getParam = function(str) {
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
        document.addEventListener("deviceready", function() {
            var options = {
                auth_url: 'http://dev.domelab.com/auth/login/authorize',
                token_url: 'http://dev.domelab.com/auth/login/access_token',
                client_id: '1',
                client_secret: '123456',
                redirect_uri: 'http://dev.domelab.com'
            }

            //Generate Login URL
            var paramObj = {
                client_id: options.client_id,
                redirect_uri: options.redirect_uri,
                response_type: options.response_type
            };
            var login_url = options.auth_url + '?' + $$.serializeObject(paramObj);
            //Open an inappbrowser but not show it to user
            var ref = window.open(login_url, "_blank", "hidden=yes,clearcache=yes");
            var count = 0;
            ref.addEventListener('loadstart', function(e) {
                var url = e.url;
                url = url.split("#")[0];

                var code = url.getParam("code");
                if (code) {
                    ref.close();
                    //Get access token
                    $$.ajax({
                        url: options.token_url,
                        data: {
                            code: code,
                            client_id: options.client_id,
                            client_secret: options.client_secret,
                            redirect_uri: options.redirect_uri,
                            grant_type: "authorization_code"
                        },
                        method: 'POST',
                        success: function(data) {
                            //Get userInfo
                            var dataObj = JSON.parse(data);
                            $$.getJSON('http://dev.domelab.com/auth/login/user', {
                                oauth_token: dataObj.access_token
                            }, function(d) {
                                console.log(d);
                                if ((d instanceof Object)) {
                                    judgeInfo = {
                                        userId: d.id,
                                        email: d.info.email,
                                        nickname: d.extra.nickname,
                                        authToken: d.info.private_token
                                    };
                                    localStorage.setItem("judgeInfo", JSON.stringify(judgeInfo));
                                    console.log('userInfo saved!');
                                    app.showJudge(judgeInfo);
                                    app.onLogin(judgeInfo.authToken);

                                }
                            });
                        },
                        error: function(error) {
                            console.log(error);
                        }
                    });
                }
            });
            ref.addEventListener('loadstop', function(e) {
                if (e.url === "http://dev.domelab.com/account/sign_in") {
                    if (!count) {
                        count++;
                        window.plugins.toast.showShortCenter("请登录");
                        $$("#login-btn").on('click', function() {
                            var username = $$("#username").val();
                            var password = $$("#password").val();
                            if (typeof username === "string" && typeof password === "string") {
                                //Inject script to inappbrowser to submit the login form
                                var script = "document.getElementsByName('user[login]')[0].value='" + username.replace(/\s+/g, '') + "';" + "document.getElementsByName('user[password]')[0].value='" + password.replace(/\s+/g, '') + "';" + "document.getElementById('new_user').submit();"
                                ref.executeScript({
                                    code: script
                                }, function(values) {
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
    },
    bind: function() {
        //Globle ajax error handller
        $$(document).on('ajaxError', function(e) {
            var xhr = e.detail.xhr;
            console.log(xhr);
            if (xhr.status === 401) {
                myApp.alert("登陆失效，请重新登陆", "");
                localStorage.removeItem("judgeInfo");
                judgeInfo = {};
                mainView.router.loadPage("index.html");
                MessageBus.stop();
                $$("#judge-info").hide();
                $$("#login-container").show();
                app.login();
            }
        });

        //Save uuid in keychain
        document.addEventListener("deviceready", function() {
            var ss = new cordova.plugins.SecureStorage(
                function() {
                    console.log('Success')
                },
                function(error) {
                    console.log('Error ' + error);
                },
                'robodou');

            ss.get(
                function(value) {
                    console.log('Success, got ' + value);
                    uuid = value;
                },
                function(error) {
                    console.log('Error ' + error);
                    ss.set(
                        function(key) {
                            console.log('Set ' + key);
                            uuid = key;
                        },
                        function(error) {
                            console.log('Error ' + error);
                        },
                        'uuid', device.uuid);
                },
                'uuid');
        });

        //Listening network status
        document.addEventListener("offline", function() {
            myApp.alert("请打开你的网络", "");
        }, false);

        
        $$(document).click(function() {
            $$('.wrapper－dropdown').removeClass('active');
        });

        //Check uuid
        $$('#msg').on('taphold', function() {
            myApp.alert(uuid, '');
        });

        //Handling logout
        $$(document).on("click", "#logout-btn", function() {
            judgeInfo = {};
            var channel = "/channel/" + judgeInfo.authToken;
            localStorage.removeItem("judgeInfo");
            MessageBus.unsubscribe(channel, function() {
                console("unsubscribe");
            });
            MessageBus.stop();
            $$("#judge-info").hide();
            $$("#login-container").show();
            app.login();
        });
        
        $$(document).on("click", "#getPlyaer", function() {
            var playerId = $$("#playerId").val();
            if (playerId) {
                app.teamInfo(playerId);
            } else {
                myApp.alert("请输入选手编号", "");
            }
        });

        $$(document).on("click", "#QR", function() {
            cordova.plugins.barcodeScanner.scan(
                function(result) {

                    if (result.text) {
                        myApp.alert("获得二维码: " + result.text);
                        app.teamInfo(result.text);
                    } else {
                        myApp.alert("请输入选手编号", "");
                    }

                },
                function(error) {
                    myApp.alert("扫描失败: " + error);
                }
            );

        });

    },
    onLogin: function(token) {
        //get realtime message
        app.subscribeMsg(token);
        app.getResponse("27918d29c6ef4319a7d4bc92228187be");
    },
    showJudge: function(judge) {
        console.log(judge);
        $$("#judgeId").text(judge.userId);
        $$("#judgeName").text(judge.nickname);
        $$("#login-container").hide();
        $$("#judge-info").show();
    },
    getProcess: function() {
        if (typeof temp.process === 'string') {
            $$("#schedule").html(temp.process);
        } else {
            $$.getJSON("http://dev.domelab.com/api/v1/competitions", function(process) {
                console.log(process);
                var processTemp = $$('#processTemp').html();
                var compiledTemp = Template7.compile(processTemp);
                var html = compiledTemp(process);
                temp.process = html;
                $$("#schedule").html(html);
            });
        }

    },
    getResponse: function(token) {
        $$.getJSON("http://192.168.1.128:3000/api/v1/users/" + token + "/user_for_event", function(response) {
            $$("#judgeComptition").text(response.events[0].comp_name);
            var events = [];
            response.events.forEach(function(e) {
                events.push(e.name);
                app.getScoreAttr(e.id);
            });
            $$("#judgeEvent").text(events.toString());
        });
    },
    getEvents: function(comp_id) {
        $$.getJSON("http://192.168.1.128:3000/api/v1/competitions/events", {
            "comp_id": comp_id
        }, function(response) {
            console.log(response);
            var schoolGroups = {
                1: "小",
                2: "中",
                3: "初",
                4: "高"
            };
            response.events.forEach(function(g1, index1) {
                g1.events.forEach(function(g2, index2) {
                    var groupId = "group" + g2.id + "-" + g2.group;
                    if (index1 === 0 && index2 === 0) {
                        $$("#groups").append('<li><a href="#' + groupId + '" class="tab-link active">' + g2.name + '(' + schoolGroups[g2.group] + ')</a></li>');
                    } else {
                        $$("#groups").append('<li><a href="#' + groupId + '" class="tab-link">' + g2.name + '(' + schoolGroups[g2.group] + ')</a></li>');
                    }
                    $$("#eventsBoard .tabs").append('<div class="tab" id="' + groupId + '"></div>');
                    if (g2.z_e) {
                        g2.z_e.forEach(function(ev) {
                            $$('<div data-id="' + ev.id + '">' + ev.name + '</div>').appendTo("#" + groupId).on("click", function() {
                                var compete = {
                                    id: $$(".compete-select .active").data("id"),
                                    name: $$(".compete-select .active").text()
                                };
                                var event = {
                                    id: $$(this).data("id"),
                                    name: $$(this).text(),
                                    group: g2.group
                                }
                                temp.compete = compete;
                                temp.event = event;
                                mainView.router.loadPage('player.html');
                            });
                        });
                        if (index1 === 0 && index2 === 0) {
                            $$(("#" + groupId)).addClass("active");
                        }
                    }
                });
            });
        });
    },
    getScoreAttr: function(event_id) {
        $$.getJSON("http://192.168.1.128:3000/api/v1/events/score_attributes", {
            "event_id": event_id
        }, function(response) {
            console.log(response);
            //scoreAttr[event_id] = response;
        });
    },
    getTeams: function(ed, group, schedule) {
        var data = {
            "ed": ed,
            "group": group
        };
        if (typeof schedule === "string") {
            data.schedule = schedule;
        }
        
        function htmlToElement(html) {
            var template = document.createElement('template');
            template.innerHTML = html;
            return template.content.firstChild;
        }

        $$.getJSON("http://192.168.1.128:3000/api/v1/competitions/event/teams", data, function(response) {
            console.log(response.teams);
            if (response.teams[0]) {
                var teams = response.teams[1];
                var allTeamId = [];
                teams.forEach(function(t) {
                    allTeamId.push(t.id);
                    var mobile = t.mobile || "无";
                    var school = t.school;
                    var teacher = t.teacher || "无";
                    var teacher_mobile = t.teacher_mobile || "无";
                    var status = t.status;
                    var statusStr, trClass;
                    if (status === 0) {
                        statusStr = "未完赛";
                        trClass = "unfinished";
                    } else if (status === 1) {
                        statusStr = " 已完赛";
                        trClass = "finished"
                    }
                    $$("#playerTable tbody").append(htmlToElement("<tr class='" + trClass + "'><td>" + t.name + "</td><td>" + school + "</td><td>" + mobile + "</td><td>" + teacher + "<br>" + teacher_mobile + "</td><td>" + statusStr + "</td></tr>"));
                });
            }

        });

    },
    teamInfo: function(playerId) {
        if (typeof playerId === "string") {
            var url = "http://dev.domelab.com/api/v1/users/" + judgeInfo.authToken + "/team_players";
            $$.getJSON(url, {
                identifier: playerId
            }, function(data) {
                if (!data.result[0]) {
                    if (typeof data.result[1] === "string")
                        myApp.alert(data.result[1], "");
                    return;
                } else {
                    var team = data.result[1][0];
                    temp.player = {
                        name: team.team_name,
                        code: $$("#playerId").val()
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
            console.log("no playerId");
        }
    },
    getMsg: function(token, page, per) {
        $$.getJSON("http://192.168.1.128:3000/api/v1/users/" + token + "/notifications/", {
            "page": page,
            "per_page": per
        }, function(response) {
            console.log(response);
            response.notifications.forEach(function(n) {
                var d = new Date(n.created_at);
                var time = d.toLocaleString().replace("GMT+8", "");
                $$("#msgBoard ul").append("<li><p class='time'>" + time + "</p><p class='content'>" + n.content + "</p></li>");
            });
        });
    },
    subscribeMsg: function(token) {
        //Get unread counts
        $$.getJSON("http://dev.domelab.com/api/v1/users/" + token + "/notifications/unread ", function(unread) {
            console.log(unread);
            $$("#msg").addClass("newMsg");
        });
        //Subscribe message
        var channel = "/channel/" + token;
        MessageBus.start();
        MessageBus.callbackInterval = 500;
        MessageBus.subscribe(channel, function(d) {
            console.log(d);
            myApp.addNotification({
                title: '重要通知',
                message: d.content
            });
            msgDB.post(d).then(function(response) {
                console.log(response);
            }).catch(function(err) {
                console.log(err);
            });;
            // $$("#msgBoard ul").append("<li><p class='time'>" + d.time + "</p><p class='content'>" +
            //     d.content + "</p></li>");
            $$("#msg").addClass("newMsg");
        });

    },
    takePhoto: function(limit) {
        var photoSuccess = function(mediaFiles) {
            var i, path, len;
            for (i = 0, len = mediaFiles.length; i < len; i += 1) {
                path = mediaFiles[i].fullPath;
                console.log(path);
                $$("#photos").append('<img src="' + path + '">');
            }
        };

        // capture error callback
        var photoError = function(error) {
            myApp.alert('Error code: ' + error.code, null, 'Capture Error');
        };

        // start image capture
        navigator.device.capture.captureImage(photoSuccess, photoError, {
            limit: limit
        });
    },
    takeVideo: function() {
        // capture callback
        var videoSuccess = function(mediaFiles) {

            var path = mediaFiles[0].fullPath;
            var type = mediaFiles[0].type;
            var v = "<video controls='controls'>";
            v += "<source src='" + path + "' type='" + type + "'>";
            v += "</video>";
            $$("#video").append(v);
        };

        // capture error callback
        var videoError = function(error) {
            myApp.alert('Error code: ' + error.code, null, 'Capture Error');
        };

        // start video capture
        navigator.device.capture.captureVideo(videoSuccess, videoError, {
            limit: 1,
            duration: 300
        });
    },
    submitScore: function(drawed) {
        var scoreData = {
            _attachments: {},
            score1: {},
            score2: {}
        };
        var remark;
        //Get score1
        $$(".score").each(function(i, obj) {
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
            myApp.alert("请让参赛者签名", "");
            return;
        }
        //Get remark
        remark = $$("#remarkInput").val();
        if (remark) {
            scoreData.remark = remark;
        }
        //Get signature
        var CanvasElement = document.getElementById("canvas");

        CanvasElement.toBlob(function(blob) {
            var signature = {
                content_type: "image/jpeg",
                data: blob
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
        scoreDB.put(scoreData).then(function(response) {
            app.uploadScore(response.id, function() {
                myApp.hidePreloader();
                myApp.alert("成绩已上传", "", function() {
                    mainView.router.back();
                });
            });
        }).catch(function(err) {
            console.log(err);
        });
    },
    uploadScore: function(doc_id, success) {
        scoreDB.get(doc_id, {
            attachments: true,
            binary: true
        }).then(function(doc) {
            var toPost = {
                event_id: doc.event.id,
                schedule_name: doc.schedule_name,
                kind: doc.kind,
                th: doc.th,
                team1_id: doc.player.code, // team2_id:doc.player.id,
                score1: doc.score1,
                note: doc.remark || "",
                confirm_sign: doc._attachments.signature.data,
                device_no: device.uuid
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
                method: "POST",
                url: "http://dev.domelab.com/api/v1/scores/" + judgeInfo.authToken + "/score",
                contentType: "multipart/form-data",
                data: form_data,
                dataType: "json",
                success: function(response) {
                    console.log(response);
                    doc.upload = "Yes";
                    return scoreDB.put(doc);
                },
                error: function(error) {
                    console.log(error);
                }
            });

        }).then(function(response) {
            if (typeof success === "function") {
                success();
            }
        }).catch(function(err) {
            console.log(err);
        });
    }
};

myApp.onPageInit('player', function(page) {
    app.getTeams(temp.event.id, temp.event.group);
    $$("#playerTable select").change(function() {
        var filter = $(this).val();
        if (filter === "unfinished") {
            $$("#playerTable .finished").css("display", "none");
            $$("#playerTable .unfinished").css("display", null);
        } else if (filter === "finished") {
            $$("#playerTable .unfinished").css("display", "none");
            $$("#playerTable .finished").css("display", null);
        } else {
            $$("#playerTable tr").css("display", null);
        }
    });

});

myApp.onPageBeforeInit('home', function(page) {
    if (judgeInfo.hasOwnProperty("userId")) {
        app.showJudge(judgeInfo);
        app.getResponse("27918d29c6ef4319a7d4bc92228187be");
    } else {
        $$("#login-container").show();
        $$("#judge-info").hide();
        app.login();
    }
    app.getProcess();
});

myApp.onPageInit('select', function(page) {
    app.getEvents(1);
    // $$("#eventsBoard .tab div").on("click", function () {
    //     var compete = {
    //         id: $$(".compete-select .active").data("id")
    //         , name: $$(".compete-select .active").text()
    //     };
    //     var event = {
    //         id: $$(this).data("id")
    //         , name: $$(this).text()
    //     }
    //     temp.compete = compete;
    //     temp.event = event;
    //     mainView.router.loadPage('player.html');
    // });
});

myApp.onPageInit('msg', function(page) {
    $$("#msg").removeClass("newMsg");
    msgDB.allDocs({
        include_docs: true,
        attachments: false
    }).then(function(result) {
        console.log(result.rows);
    }).catch(function(err) {
        console.log(err);
    });

    app.getMsg("27918d29c6ef4319a7d4bc92228187be", 1, 20)
});

myApp.onPageInit('player', function() {

    $$(".wrapper－dropdown").on('click', function(event) {
        $$(this).toggleClass("active");
        event.stopPropagation();
    });
    $$(".wrapper－dropdown li").on('click', function() {
        var filter = $$(this).attr("name");
        $$(".wrapper－dropdown span").text($$(this).text());
        if (filter === "unfinished") {
            $$("#playerTable .finished").css("display", "none");
            $$("#playerTable .unfinished").css("display", null);
        } else if (filter === "finished") {
            $$("#playerTable .unfinished").css("display", "none");
            $$("#playerTable .finished").css("display", null);
        } else {
            $$("#playerTable tr").css("display", null);
        }
    });
});

myApp.onPageInit('data', function(page) {
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
        include_docs: true,
        attachments: false
    }).then(function(result) {
        console.log(result);
        var template = $$("#data-item").html();
        var compiledTemp = Template7.compile(template);
        result.rows.forEach(function(element, index) {
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
        $$(".upload-all").on("click", function() {
            if (length) {
                console.log(toUpload);
                var newLength = length;
                myApp.showPreloader("正在上传");
                toUpload.forEach(function(i) {
                    app.uploadScore(i, function() {
                        if (newLength > 0) {
                            if (newLength === 1) {
                                myApp.hidePreloader();
                                mainView.router.loadPage('Uploaded.html');
                            } else {
                                newLength--;
                            }
                        }
                    });
                });

            }
        });
        console.log(toUpload);

    }).catch(function(err) {
        console.log(err);
    });
});

myApp.onPageInit('stopWatch', function(page) {
    var scoreFrom;
    var drawed = 0;
    if (scoreAttr) {
        scoreAttr.forEach(function(sa, index) {
            switch (sa.type) {
                case "a1":
                    scoreFrom = 1;
                    $$("#team1 .scores").append('<div>' + sa.name + '：<input class="track-score score" name="score' + (index + 1) + '"></div>');
                    break;
                case "a2":
                    scoreFrom = 2;
                    $$("#team1 .scores").append('<div>' + sa.name + '：<input class="time-score score" name="score' + (index + 1) + '"></div>');
                    break;
                case "a3":
                    scoreFrom = 3;
                    $$(".scrollable").css("height", "500px");
                    $$("#scoreHeader").hide();
                    $$("#team1 .scores").append('<div>' + sa.name + '：<input class="score" name="score' + (index + 1) + '"></div>');
                    break;
                case "b1":
                    $$("#team1 .scores").append('<div>' + sa.name + '：<input class="final-score score" name="score' + (index + 1) + '"></div>');
                    break;
            }
        });
    }


    $$("#takePhoto").on("click", function() {
        var quantity = $$("#photos img").length;
        if (quantity === 3) {
            myApp.alert("最多拍三张照片", "");
        } else {
            app.takePhoto(1);
        }
    });

    $$("#takeVideo").on("click", function() {
        if ($$("#video video").length) {
            myApp.confirm("是否重新拍摄视频？", function() {
                $$("#video").html("");
                app.takeVideo();
            });
        } else {
            app.takeVideo();
        }

    });


    if (temp.playerInfo) {
        $$(".playerInfo").append(temp.playerInfo);
        var mySwiper = myApp.swiper('.swiper-container', {
            pagination: '.swiper-pagination',
            paginationHide: false,
            paginationClickable: true
        });
    }

    $$("#submitScore").on("click", function() {
        app.submitScore(drawed);
    });
    console.log(scoreFrom);
    if (scoreFrom === 1) {
        $$("#scoreHeader").html('<div id="raceUp"><img src="images/raceUp.png"></div>');
        document.getElementById('raceUp').onclick = function() {
            track.raceUp()
        };

    } else if (scoreFrom === 2) {
        $$("#scoreHeader").html('<div id="stopwatch"><div id="time"></div><div class="btn-wrapper"><span id="reset" class="sm-circle-btn">重置</span> <span id="record" class="sm-circle-btn">录入</span><span id="start" class="sm-circle-btn">开始</span></div></div>');
        (function() {
            var Stopwatch = function() {
                var startAt = 0;
                var lapTime = 0;

                var now = function() {
                    return (new Date()).getTime();
                };

                this.start = function() {
                    startAt = startAt ? startAt : now();
                };

                this.stop = function() {
                    lapTime = startAt ? lapTime + now() - startAt : lapTime;
                    startAt = 0;
                };

                this.reset = function() {
                    lapTime = startAt = 0;
                };

                this.time = function() {
                    return lapTime + (startAt ? now() - startAt : 0);
                };
            };
            var x = new Stopwatch();
            var $time;
            var clocktimer;
            var total;
            var timeLimit = temp.event.time_limit * 1000;

            var timeoutHander = function() {
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
                var elements = document.getElementsByClassName("time-score");
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
                            document.querySelector('.final-score').value = formatTime(total);
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
        }());

    }

    var canvas = document.getElementById('canvas');
    var context = canvas.getContext("2d");
    canvas.addEventListener("touchstart", touchStartHandler, false);
    canvas.addEventListener("touchmove", touchMoveHandler, false);
    canvas.addEventListener("touchend", touchEndHandler, false);
    document.getElementById("clearCanvas").onclick = function() {
        drawed = 0;
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