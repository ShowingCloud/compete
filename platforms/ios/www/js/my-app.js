// "use strict";
// Initialize the app
window.onload = function() {
    navigator.splashscreen.hide();
};

var myApp = new Framework7({
    tapHold: true,
    modalButtonOk: '确定',
    modalButtonCancel: '取消',
    modalTitle: 'Robodou'
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

//Not use remote PouchDb server
var remoteCouch = false;

// apption for app
var app_options = {
    host: "http://dev.robodou.cn",
    //host: "http://test.robodou.cn",
};

var scoreAttr = [];

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
    compete: {},
    event: {},
    schedule_name: "",
    kind: 1,
    th: 1,
    team1_id: 0,
    team2_id: 0,
    unread: {
        count: 0,
        ids: []
    }
};

var judgeInfo = {};

function listDir(path) {
    window.resolveLocalFileSystemURL(path,
        function(fileSystem) {
            var reader = fileSystem.createReader();
            reader.readEntries(
                function(entries) {
                    console.log(entries);
                },
                function(err) {
                    console.log(err);
                }
            );
        },
        function(err) {
            console.log(err);
        }
    );
}

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
    action: {
        "run": "开始",
        "openDoor": "开门",
        "closeDoor": "关门",
        "reset": "重置",
        "getScore": "拿分"
    },
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
                    track.status.playing = 0;
                    var time = d[5] + d[4] * 256 + d[3] * 256 * 256 + d[2] * 256 * 256 * 256;
                    if (time > temp.event.limit * 1000) {
                        myApp.alert("已超时：" + track.formatTime(time) + "秒", "");
                        racke.render(temp.event.limit * 1000);
                    } else {
                        track.render(time);
                    }
                    myApp.alert(track.formatTime(time), "");

                    break;
                case 3:
                    window.plugins.toast.showShortCenter("信息错误");
                    break;
            }
        } else {
            myApp.alert("收到奇怪的数据:" + dataStr, "");
        }
    },
    run: function() {
        track.order = [170, 1, 0, 0, 255];
        track.status.sending = "run";
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
                window.plugins.toast.showShortCenter(track.action[track.status.sending] + "指令已发送");
                if (track.status.sending === "run") {
                    track.status.playing = 1;
                    // setTimeout(function(){
                    //     if(track.status.playing){
                    //         myApp.alert("已超时,未完成","");
                    //         racke.render(temp.event.limit * 1000);
                    //     }
                    // },temp.event.time_limit*1000+3000);
                }
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
                    window.plugins.toast.showLongCenter("本次记分已完成");
                    document.getElementById('run').onclick = null;
                    total = 0;
                    for (var i = 0; i < elements.length; i++) {
                        total = total + track.unformat(elements[i].value);
                    }
                    document.querySelector('.final-score').value = track.formatTime(total);
                }
                break;
            }
        }
    }
}

var app = {
    init: function() {
        document.addEventListener('DOMContentLoaded', function() {
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

                app.login();
            }

            $$("#asideBar a").on("click", function(e) {
                var href = $$(this).data("href");
                if (mainView.activePage.name === "stopWatch") {
                    if (href !== "stopWatch.html") {
                        myApp.confirm("是否放弃本次记分？", "", function(goto) {
                            mainView.router.loadPage(href);
                            if (track.status.playing) {
                                track.reset();
                            }
                        });
                    }
                } else {
                    mainView.router.loadPage(href);
                }
            });
        }, false);

    },
    login: function() {
        $$("#login-container").show();
        $$("#judge-info").hide();
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
                auth_url: app_options.host + '/auth/login/authorize',
                token_url: app_options.host + '/auth/login/access_token',
                client_id: '1',
                client_secret: '123456',
                redirect_uri: app_options.host + ''
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
                            $$.getJSON(app_options.host + '/auth/login/user', {
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
                if (e.url === app_options.host + "/account/sign_in") {
                    if (!count) {
                        count++;
                        window.plugins.toast.showShortCenter("请登录");
                        $$("#login-btn").on('click', function() {
                            var username = $$("#username").val();
                            var password = $$("#password").val();
                            if (username && password) {
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
        //Set ajax timeout
        $$(document).on('ajaxStart', function (e) {
            e.detail.xhr.timeout=5000;
        });
        
        //Globle ajax error handller
        $$.ajaxSetup({
            timeout:5000,
            error: function (xhr, status) {
                if (xhr.status === 401) {
                    if ((new URL(xhr.requestUrl)).origin === app_options.host) {
                        myApp.alert("登陆失效，请重新登陆", "", function() {
                            localStorage.removeItem("judgeInfo");
                            judgeInfo = {};
                            if (mainView.activePage.name === "home") {
                                app.login();
                            } else {
                                mainView.router.loadPage("index.html");
                            }
                            MessageBus.stop();
                        });

                    }
                }
                if ( status === "timeout") {
                    window.plugins.toast.showShortCenter("请求超时，请稍候重试");
                    myApp.hideIndicator();
                    myApp.hidePreloader();
                }
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
            cordova.plugins.barcoscore_typeanner.scan(
                function(result) {
                    screen.lockOrientation('portrait');
                    if (result.text) {
                        myApp.alert("获得二维码: " + result.text, "");
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
        app.getResponse(token);
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
            $$.getJSON(app_options.host + "/api/v1/competitions", function(process) {
                console.log(process);
                var processTemp = $$('#processTemp').html();
                var compiledTemp = Template7.compile(processTemp);
                var html = compiledTemp(process);
                temp.process = html;
                $$("#schedule").html(html);
            });
        }
    },
    getSchedule: function(ed, group) {
        var data = {
            "ed": ed,
            "group": group
        };
        $$.getJSON(app_options.host + "/api/v1/events/event_schedule", data, function(response) {
            var schedules = response.event_schedules;
            if (schedules.length === 0) {
                myApp.alert("该比赛没有赛程,无法继续", "");
            } else if (schedules.length > 1) {
                var compiledTemp = Template7.compile($$('#roundTpl').html());
                var newPageContent = compiledTemp(response);
                mainView.router.loadContent(newPageContent);
                mainView.router.load({
                    content: newPageContent,
                    animatePages: false
                });
            } else {
                temp.kind = schedules[0].kind;
                temp.schedule_name = schedules[0].schedule_name;
                temp.schedule_id = schedules[0].schedule_id;
                mainView.router.loadPage('player.html');
            }
        });
    },
    getResponse: function(token) {
        $$.getJSON(app_options.host + "/api/v1/users/" + token + "/user_for_event", function(response) {
            $$("#judgeComptition").text(response.events[0].comp_name);
            var events = [];
            response.events.forEach(function(e) {
                events.push(e.name);
                //app.getScoreAttr(e.id);
            });
            $$("#judgeEvent").text(events.toString());
        });
    },
    getEvents: function(comp_id, callback) {
        myApp.showIndicator();
        $$.getJSON(app_options.host + "/api/v1/competitions/events", {
            "comp_id": comp_id
        }, function(response) {
            console.log(response);
            myApp.hideIndicator();
            if (typeof callback === "function") {
                callback(response.events);
            }
        });
    },
    getScoreAttr: function(event_id) {
        $$.getJSON(app_options.host + "/api/v1/events/score_attributes", {
            "event_id": event_id
        }, function(response) {
            if (response.event_score_attributes.length) {
                scoreAttr = response.event_score_attributes;
            } else {
                myApp.alert("无此项目数据", "")
            }
        });
    },
    getTeams: function(data) {
        function htmlToElement(html) {
            var template = document.createElement('template');
            template.innerHTML = html;
            return template.content.firstChild;
        }

        $$.getJSON(app_options.host + "/api/v1/events/event/teams", data, function(response) {
            console.log(response.teams);
            if (response.teams[0]) {
                var teams = response.teams[1];
                var allTeamId = [];
                var tbody = $$("#playerTable tbody");
                tbody.html("");
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
                    tbody.append(htmlToElement("<tr class='" + trClass + "'><td>" + t.name + "</td><td>" + school + "</td><td>" + mobile + "</td><td>" + teacher + "<br>" + teacher_mobile + "</td><td>" + statusStr + "</td></tr>"));
                });
            }

        });
    },
    teamInfo: function(playerId) {
        if (typeof playerId === "string") {
            var url = app_options.host + "/api/v1/users/" + judgeInfo.authToken + "/team_players";
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
    getMsg: function(token) {
        $$.getJSON(app_options.host + "/api/v1/users/" + token + "/notifications/", function(response) {
            console.log(response);
            response.notifications.forEach(function(n) {
                var d = new Date(n.created_at);
                var time = d.toLocaleString().replace("GMT+8", "");
                $$("#msgBoard ul").append("<li><p class='time'>" + time + "</p><p class='content'>" + n.content + "</p></li>");

            });
        });
    },

    setRead: function(token, msgid, callback) {
        $$.post(app_options.host + '/api/v1/users/' + token + '/update_notify_read', {
            id: msgid
        }, function(data) {
            console.log(data);
            if (typeof callback === "function") {
                callback();
            }
        });
    },
    subscribeMsg: function(token) {
        //Get unread counts
        $$.getJSON(app_options.host + "/api/v1/users/" + token + "/notifications", function(msg) {
            console.log(msg);

            msg.notifications.forEach(function(n) {
                if (!n.read) {
                    temp.unread.ids.push(n.id);
                }
            });
            if (msg.unread > 0) {
                $$("#msg").addClass("more");
            }
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
            $$("#msg").addClass("more");
        });

    },
    takePhoto: function(limit) {
        var photoSuccess = function(mediaFiles) {
            var i, path, len;
            for (i = 0, len = mediaFiles.length; i < len; i += 1) {
                path = mediaFiles[i].fullPath;
                console.log(mediaFiles[i]);
                $$("#photos").append('<img src="' + path + '">');
            }
        };

        // capture error callback
        var photoError = function(error) {
            console.log('Error code: ' + error.code, null, 'Capture Error');
        };

        // start image capture
        navigator.device.capture.captureImage(photoSuccess, photoError, {
            limit: limit
        });
    },
    takeVideo: function() {
        // capture callback
        var videoSuccess = function(mediaFiles) {
            console.log(mediaFiles);
            var path = mediaFiles[0].fullPath;
            var type = mediaFiles[0].type;
            console.log("video path:" + path);
            VideoEditor.createThumbnail(
                function(result) {
                    console.log("Thumbnail path:" + result, "");
                    var v = "<video controls='controls' poster='" + result + "' >";
                    v += "<source src='" + path + "' type='" + type + "'>";
                    v += "</video>";
                    $$("#video").append(v);
                }, // success cb
                function(e) {
                    var v = "<video controls='controls'>";
                    v += "<source src='" + path + "' type='" + type + "'>";
                    v += "</video>";
                    $$("#video").append(v);
                    console.log(e);
                }, // error cb
                {
                    fileUri: path, // the path to the video on the device
                    outputFileName: 'thumbnail', // the file name for the JPEG image
                    atTime: 2, // optional, location in the video to create the thumbnail (in seconds)
                    width: 320, // optional, width of the thumbnail
                    height: 480, // optional, height of the thumbnail
                    quality: 100 // optional, quality of the thumbnail (between 1 and 100)
                }
            );
        };

        // capture error callback
        var videoError = function(error) {
            console.log('Error code: ' + error.code, null, 'Capture Error');
        };

        // start video capture
        navigator.device.capture.captureVideo(videoSuccess, videoError, {
            limit: 1,
            duration: 300
        });
    },
    submitScore: function(drawed) {
        function saveScore() {
            scoreDB.put(scoreData).then(function(response) {
                app.uploadScore(response.id, function() {
                    myApp.hidePreloader();
                    myApp.alert("成绩已上传", "", function() {
                        mainView.router.back();
                    });
                }, function() {
                    myApp.alert("成绩上传失败，请稍后再上传", "", function() {
                        mainView.router.back();
                    });
                });
            }).catch(function(err) {
                console.log(err);
            });
        }

        function saveVideo() {
            if ($$("#video source").length) {
                myApp.showPreloader("视频转码中，请稍等。。。");
                VideoEditor.transcodeVideo(
                    videoTranscodeSuccess,
                    videoTranscodeError, {
                        fileUri: $$("#video source").attr("src"),
                        outputFileName: new Date().toISOString(),
                        outputFileType: VideoEditorOptions.OutputFileType.MPEG4,
                        optimizeForNetworkUse: VideoEditorOptions.OptimizeForNetworkUse.YES,
                        saveToLibrary: true,
                        maintainAspectRatio: true,
                        width: 480,
                        height: 360,
                        videoBitrate: 720000,
                        audioChannels: 2,
                        audioSampleRate: 44100,
                        audioBitrate: 128000, // 128 kilobits
                        progress: function(info) {
                            console.log('transcodeVideo progress callback, info: ' + info);
                        }
                    }
                );

                function videoTranscodeSuccess(result) {
                    myApp.hidePreloader();
                    scoreData.video = result;
                    saveScore();
                    VideoEditor.getVideoInfo(
                        function(info) {
                            console.log('getVideoInfoSuccess, info: ' + JSON.stringify(info, null, 2));
                        },
                        function(error) {
                            console.log(error);
                        }, {
                            fileUri: result
                        }
                    );
                }

                function videoTranscodeError(err) {
                    myApp.hidePreloader();
                    console.log('videoTranscodeError, err: ' + err);
                }
            } else {
                saveScore();
            }
        }
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
        scoreData.schedule_id = temp.schedule_id
        scoreData.th = temp.th;
        scoreData.upload = false;
        var images = $$("#photos img");
        if (images.length) {
            scoreData.img = [];
            images.each(function(index, img) {
                var uri = img.src;
                var ext = uri.split('.').pop();
                var filename = new Date().valueOf().toString() + index + "." + ext;
                var fail = function(err) {
                    console.log(err)
                }
                window.resolveLocalFileSystemURL(cordova.file.dataDirectory, function(destination) {
                    window.resolveLocalFileSystemURL(uri, function(file) {
                        file.moveTo(destination, filename, function(e) {
                            console.log(e);
                            // file.remove(function(){console.log("removed")},fail);
                            console.log("file copyed");
                            scoreData.img.push(e.nativeURL);
                            if (scoreData.img.length === images.length) {
                                console.log("img done");
                                saveVideo();
                            }
                        });
                    }, fail);
                }, fail);
            });

        } else {
            saveVideo();
        }

    },
    uploadScore: function(doc_id, success, fail, complete) {
        scoreDB.get(doc_id, {
            attachments: true,
            binary: true
        }).then(function(doc) {
            var toPost = {
                event_id: doc.event.id,
                schedule_name: doc.schedule_name,
                schedule_id: doc.schedule_id,
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
                url: app_options.host + "/api/v1/scores/" + judgeInfo.authToken + "/score",
                contentType: "multipart/form-data",
                data: form_data,
                dataType: "json",
                success: function(response) {
                    console.log(response);
                    doc.upload = "Yes";
                    scoreDB.put(doc);
                    if (typeof success === "function") {
                        success();
                    }
                },
                error: function(error) {
                    console.log(error);
                    if (typeof fail === "function") {
                        fail();
                    }
                },
                complete: function() {
                    if (typeof complete === "function") {
                        complete();
                    }
                }
            });

        }).catch(function(err) {
            console.log(err);
        });
    }
};

myApp.onPageBeforeInit('home', function(page) {
    if (judgeInfo.hasOwnProperty("userId")) {
        app.showJudge(judgeInfo);
        app.getResponse(judgeInfo.authToken);
    } else {

        app.login();
    }
    app.getProcess();
});

myApp.onPageInit('select', function(page) {
    $$("#groups,#eventsBoard .tabs").html("");
    var event_id=temp.event.id;
    function showEvents(events) {
        var schoolGroups = {
            1: "小",
            2: "中",
            3: "初",
            4: "高"
        };
        console.log(events);
        events.forEach(function(g1, index1) {
            g1.events.forEach(function(g2, index2) {
                var groupId = g2.group;
                var groupName="group" + "-" + groupId;
                var tabName="tab"+"_"+groupId;
                var tab = $$('<li><a  id="'+tabName+'" href="#' + groupName + '" class="tab-link">' + g2.name + '(' + schoolGroups[g2.group] + ')</a></li>')
                tab.appendTo("#groups");
                $$("#eventsBoard .tabs").append('<div class="tab" id="' + groupName + '"></div>');
                if (g2.z_e) {
                    g2.z_e.forEach(function(ev) {
                        var div;
                        if(event_id==ev.id && groupId==temp.event.group){
                           div = '<div class="selected" data-id="' + ev.id + '">' + ev.name + '</div>'
                        }else{
                           div= '<div data-id="' + ev.id + '">' + ev.name + '</div>';
                        }
                        $$(div).appendTo("#" + groupName).on("click", function() {
                            var compete = {
                                id: $$(".compete-select .active").data("id"),
                                name: $$(".compete-select .active").text()
                            };
                            var event = {
                                id: $$(this).data("id"),
                                name: $$(this).text(),
                                group: groupId
                            }
                            
                            temp.compete = compete;
                            temp.event = event;
                            app.getSchedule(event.id, event.group);
                            app.getScoreAttr(event.id);
                        });
                    });
                    
                    if(g2.group==temp.event.group){
                        document.getElementById(tabName).click();
                    }else if (index1 === 0 && index2 === 0) {
                        document.getElementById(tabName).click();
                        console.log(document.getElementById(tabName));
                    }
                }
                
            });
        });
    }
    app.getEvents(1, showEvents);
});

myApp.onPageInit('msg', function(page) {
    $$("#msg").removeClass("more");
    app.getMsg(judgeInfo.authToken);
    $$(".infinite-scroll").on("infinite", function() {
        app.getMsg(judgeInfo.authToken);
    });
    console.log(temp.unread);
    temp.unread.ids.forEach(function(id) {
        app.setRead(judgeInfo.authToken, id);
    });
    temp.unread.ids = [];
});

myApp.onPageInit('player', function() {
    app.getTeams({
        "ed": temp.event.id,
        "group": temp.event.group,
        "schedule_id": temp.schedule_id
    });
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
myApp.onPageInit('round', function() {
    $$(".round-wrapper").on('click', function() {
        var data = $$(this).dataset();
        temp.schedule_name = data.schedule_name;
        temp.schedule_id = data.schedule_id;
        mainView.router.loadPage("player.html");
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
                var uploadCount = 0;
                var uploadSuccess = 0;
                myApp.showPreloader("正在上传");
                toUpload.forEach(function(i) {
                    app.uploadScore(i, function() {
                        uploadSuccess++;
                    }, null, function() {
                        uploadCount++;
                        if (uploadCount === length) {
                            myApp.hidePreloader();
                            if (uploadSuccess === length) {
                                mainView.router.loadPage('Uploaded.html');
                            } else {
                                myApp.alert("部分上传失败", "");
                            }
                        }
                    });
                });

            }
        });

    }).catch(function(err) {
        console.log(err);
    });
});

myApp.onPageInit('stopWatch', function(page) {
    var scoreFrom;
    var drawed = 0;
    if (scoreAttr) {
        console.log(scoreAttr);
        scoreAttr.forEach(function(sa, index) {
            switch (sa.score_type) {
                case 3:
                    scoreFrom = 3;
                    $$("#team1 .scores").append('<div>' + sa.name + '：<input class="track-score score" name="score' + (index + 1) + '"></div>');
                    break;
                case 2:
                    scoreFrom = 2;
                    $$("#team1 .scores").append('<div>' + sa.name + '：<input class="time-score score" name="score' + (index + 1) + '"></div>');
                    break;
                case 1:
                    scoreFrom = 1;
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
    if (scoreFrom === 3) {
        $$("#scoreHeader").html('<div id="runWrapper"><img src="images/run.png" usemap="#runmap"><map name="runmap"><area id="run" shape="poly" coords="26,0,433,0,452,29,389,118,72,118,8,28"></map></div>');
        document.getElementById('run').onclick = function() {
            track.run()
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
    var ele;
    var clickX = [];
    var clickY = [];
    var clickDrag = [];
    var paint;
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
        ele = $$("#canvas").offset();
        console.log(ele);
        addClick(touchEvent.clientX - ele.left, touchEvent.clientY - ele.top);
        redraw();
    }

    function touchMoveHandler(e) {
        e.preventDefault();
        var touchEvent = e.changedTouches[0];
        if (paint) {
            addClick(touchEvent.clientX - ele.left, touchEvent.clientY - ele.top, true);
            redraw();
        }
        drawed++;
    }

    function touchEndHandler(e) {
        e.preventDefault();
        paint = false;
    }

    function addClick(x, y, dragging) {
        clickX.push(x);
        clickY.push(y);
        clickDrag.push(dragging);
    }

    function redraw() {
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        context.strokeStyle = "#D7E4F4";
        context.lineJoin = "round";
        context.lineCap = "round";
        context.shadowColor = "rgba(0,0,0,.5)";
        context.shadowBlur = 2;
        context.lineWidth = 2;

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