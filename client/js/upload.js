// 验证元素是否可用
function checkIsDisable(ele) {
    const classList = ele.classList
    return classList.contains('disable') || classList.contains('loading')
}

// 将选择的文件读取为 BASE64
function readAsBASE64(file) {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader
        fileReader.readAsDataURL(file)
        fileReader.onload = ({target}) => {
            resolve(target.result)
        }
        fileReader.onerror = (err) => {
            reject(err)
        }
    })
}

// 将选择的文件读取为 Buffer
function readAsBuffer(file) {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader()
        fileReader.readAsArrayBuffer(file)
        fileReader.onload = ({target}) => {
            const buffer = target.result
            const spark = new SparkMD5.ArrayBuffer()
            spark.append(buffer)
            const hash = spark.end()
            const suffix = /\.([a-zA-Z0-9]+)$/.exec(file.name)[1]
            resolve({
                buffer, hash, suffix, filename: `${hash}.${suffix}`
            })
        }
        fileReader.onerror = (err) => {
            reject(err)
        }
    })
}

// 延迟函数
const delay = function delay(interval) {
    typeof interval !== "number" ? (interval = 1000) : null;
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, interval);
    });
};

// 单一文件上传「FORM-DATA」
(function () {
    const upload = document.querySelector("#upload1"),
        upload_inp = upload.querySelector(".upload_inp"),
        upload_button_select = upload.querySelector(".upload_button.select"),
        upload_button_upload = upload.querySelector(".upload_button.upload"),
        upload_tip = upload.querySelector(".upload_tip"),
        upload_list = upload.querySelector(".upload_list");

    let _file = null;

    // 点击选择文件按钮，触发上传文件 INPUT 框选择文件的行为
    upload_button_select.addEventListener("click", function () {
        if (checkIsDisable(upload_button_select)) return;
        upload_inp.click();
    });

    // 监听用户选择文件的操作
    upload_inp.addEventListener("change", function () {
        // 获取用户选择的文件对象
        const file = upload_inp.files[0];
        if (!file) return;
        // 限制上传文件的格式
        if (!/(PNG|JPG|JPEG)/i.test(file.type)) {
            alert("上传的文件只能是 PNG/JPG/JPEG 格式的~~");
            return;
        }
        // 限制文件上传的大小
        if (file.size > 2 * 1024 * 1024) {
            alert("上传的文件不能超过2MB~~");
            return;
        }
        // 显示上传的文件
        upload_tip.style.display = "none";
        upload_list.style.display = "block";
        upload_list.innerHTML = `<li>
        <span>文件：${file.name}</span>
        <span><em>移除</em></span>
    </li>`;

        _file = file;
    });

    // 移除按钮的点击处理
    upload_list.addEventListener("click", function (evt) {
        const target = evt.target;
        if (target.tagName === "EM") {
            clearHandler();
        }
    });

    function clearHandler() {
        upload_tip.style.display = "block";
        upload_list.style.display = "none";
        upload_list.innerHTML = ``;
        _file = null;
    }

    function disableHandler(flag) {
        if (flag) {
            upload_button_select.classList.add("disable");
            upload_button_upload.classList.add("loading");
        } else {
            upload_button_select.classList.remove("disable");
            upload_button_upload.classList.remove("loading");
        }
    }

    // 上传文件到服务器
    upload_button_upload.addEventListener("click", function () {
        if (checkIsDisable(upload_button_upload)) return;
        if (!_file) {
            alert("请先选择要上传的文件~~");
            return;
        }
        // 把文件上传至服务器
        const data = new FormData();
        data.append("file", _file);
        data.append("filename", _file.name);
        disableHandler(true);
        instance
            .post("/upload_single", data)
            .then((res) => {
                if (+res.code === 0) {
                    alert(`文件上传成功~~，请基于 ${res.servicePath} 访问这个资源~~`);
                    return;
                }
                return Promise.reject(res.codeText);
            })
            .catch((err) => {
                alert("文件上传失败，请稍后重试");
            })
            .finally(() => {
                clearHandler();
                disableHandler(false);
            });
    });
})();

// 单一文件上传「BASE64」，只适合图片
(function () {
    const upload = document.querySelector("#upload2"),
        upload_inp = upload.querySelector(".upload_inp"),
        upload_button_select = upload.querySelector(".upload_button.select"),
        upload_tip = upload.querySelector(".upload_tip");

    // 点击上传图片按钮，触发上传文件 INPUT 框选择文件的行为
    upload_button_select.addEventListener("click", function () {
        if (checkIsDisable(upload_button_select)) return;
        upload_inp.click();
    });

    // 监听用户选择文件的操作
    upload_inp.addEventListener("change", async function () {
        // 获取用户选择的文件对象
        const file = upload_inp.files[0];
        if (!file) return;
        // 限制上传文件的格式
        if (!/(PNG|JPG|JPEG)/i.test(file.type)) {
            alert("上传的文件只能是 PNG/JPG/JPEG 格式的~~");
            return;
        }
        // 限制文件上传的大小
        if (file.size > 2 * 1024 * 1024) {
            alert("上传的文件不能超过2MB~~");
            return;
        }
        upload_button_select.classList.add('loading')
        try {
            const base64 = await readAsBASE64(file)
            const res = await instance.post('/upload_single_base64', {
                file: encodeURIComponent(base64),
                filename: file.name
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            })
            if (+res.code === 0) {
                alert(`文件上传成功~~，请基于 ${res.servicePath} 访问这个资源~~`);
                return
            }
            throw res.codeText
        } catch (error) {
            alert('很遗憾，文件上传失败，请稍后再试~~')
        } finally {
            upload_button_select.classList.remove('loading')
        }
    });
})();

// 单一文件上传「缩略图处理」
(function () {
    const upload = document.querySelector("#upload3"),
        upload_inp = upload.querySelector(".upload_inp"),
        upload_button_select = upload.querySelector(".upload_button.select"),
        upload_button_upload = upload.querySelector(".upload_button.upload"),
        upload_abbre = upload.querySelector('.upload_abbre'),
        upload_abbre_img = upload_abbre.querySelector('img');

    let _file = null

    function disableHandler(flag) {
        if (flag) {
            upload_button_select.classList.add("disable");
            upload_button_upload.classList.add("loading");
        } else {
            upload_button_select.classList.remove("disable");
            upload_button_upload.classList.remove("loading");
        }
    }

    // 点击选择文件按钮，触发上传文件 INPUT 框选择文件的行为
    upload_button_select.addEventListener("click", function () {
        if (checkIsDisable(upload_button_select)) return;
        upload_inp.click();
    });

    // 监听用户选择文件的操作
    upload_inp.addEventListener("change", async function () {
        // 获取用户选择的文件对象
        const file = upload_inp.files[0];
        if (!file) return;
        // 限制上传文件的格式
        if (!/(PNG|JPG|JPEG)/i.test(file.type)) {
            alert("上传的文件只能是 PNG/JPG/JPEG 格式的~~");
            return;
        }
        // 限制文件上传的大小
        if (file.size > 2 * 1024 * 1024) {
            alert("上传的文件不能超过2MB~~");
            return;
        }
        _file = file
        // 文件预览，将文件转换为 BASE64，赋值给 img
        try {
            upload_button_select.classList.add('disable')
            const base64 = await readAsBASE64(file)
            upload_abbre.style.display = 'block'
            upload_abbre_img.src = base64
        } catch (err) {
            alert('读取文件失败~~')
            return
        } finally {
            upload_button_select.classList.remove('disable')
        }
    });

    // 点击上传到服务器按钮
    upload_button_upload.addEventListener('click', async function () {
        if (checkIsDisable(upload_button_upload)) return
        if (!_file) {
            alert('请先选择要上传的文件~~')
            return
        }
        disableHandler(true)
        try {
            // 生成文件的 hash 名
            const {filename} = await readAsBuffer(_file)
            const data = new FormData()
            data.append('file', _file)
            data.append('filename', filename)
            const res = await instance.post('/upload_single_name', data)
            if (+res.code === 0) {
                alert(`文件上传成功~~，请基于 ${res.servicePath} 访问这个资源~~`);
                return
            }
            throw res.codeText
        } catch (err) {
            alert("文件上传失败，请稍后重试");
        } finally {
            disableHandler(false)
            upload_abbre.style.display = 'none'
            upload_abbre_img.src = ''
            _file = null
        }
    })
})();

// 单一文件上传「进度管控」
(function () {
    const upload = document.querySelector('#upload4'),
        upload_inp = upload.querySelector(".upload_inp"),
        upload_button_select = upload.querySelector(".upload_button.select"),
        upload_progress = upload.querySelector('.upload_progress'),
        upload_progress_value = upload_progress.querySelector('.value');

    // 点击上传文件按钮，触发上传文件 INPUT 框选择文件的行为
    upload_button_select.addEventListener('click', function () {
        if (checkIsDisable(upload_button_select)) return
        upload_inp.click()
    })

    // 监听用户选择文件的操作
    upload_inp.addEventListener('change', async function () {
        const file = upload_inp.files[0];
        if (!file) return;
        upload_button_select.classList.add('loading')
        try {
            const data = new FormData()
            data.append('file', file)
            data.append('filename', file.name)
            const res = await instance.post('/upload_single', data, {
                // 文件上传中的回调 基于 xhr.upload.onprogress 实现
                onUploadProgress(evt) {
                    const {loaded, total} = evt
                    upload_progress.style.display = 'block'
                    upload_progress_value.style.width = `${loaded / total * 100}%`
                }
            })
            if (+res.code === 0) {
                upload_progress_value.style.width = '100%';
                // transition: width 0.3s; alert 会阻塞浏览器，因此需要 delay，否则 width 没到 100% 就被阻塞了
                await delay(300)
                alert(`文件上传成功~~，请基于 ${res.servicePath} 访问这个资源~~`);
                return
            }
            throw res.codeText
        } catch (err) {
            alert('很遗憾，文件上传失败，请稍后再试~~')
        } finally {
            upload_button_select.classList.remove('loading')
            upload_progress.style.display = 'none'
            upload_progress_value.style.width = '0%'
        }
    })
})();

// 多文件上传
(function () {
    const upload = document.querySelector("#upload5"),
        upload_inp = upload.querySelector(".upload_inp"),
        upload_button_select = upload.querySelector(".upload_button.select"),
        upload_button_upload = upload.querySelector(".upload_button.upload"),
        upload_list = upload.querySelector(".upload_list");

    let _files = []

    // 控制按钮状态
    function disableHandler(flag) {
        if (flag) {
            upload_button_select.classList.add("disable");
            upload_button_upload.classList.add("loading");
            return;
        }
        upload_button_select.classList.remove("disable");
        upload_button_upload.classList.remove("loading");
    }

    // 点击选择文件按钮，触发上传文件 INPUT 框选择文件的行为
    upload_button_select.addEventListener("click", function () {
        if (checkIsDisable(upload_button_select)) return;
        upload_inp.click();
    });

    // 监听用户选择文件的操作
    upload_inp.addEventListener("change", async function () {
        _files = Array.from(upload_inp.files);
        if (!_files.length) return;
        _files = _files.map(file => {
            return {
                file,
                filename: file.name,
                key: createKey()
            }
        })
        let htmlStr = '';
        _files.forEach((item, index) => {
            htmlStr += `
            <li key="${item.key}">
                <span>文件${index + 1}：${item.filename}</span>
                <span><em>移除</em></span>
            </li>`;
        });
        upload_list.style.display = "block";
        upload_list.innerHTML = htmlStr;
    });

    // 生成唯一值
    function createKey() {
        const random = Math.random() * new Date();
        return random.toString(16).replace('.', '');
    }

    // 事件委托实现移除操作
    upload_list.addEventListener('click', function (evt) {
        const target = evt.target;
        if (target.tagName === 'EM') {
            const curItem = target.parentNode.parentNode;
            if (!curItem) return;
            upload_list.removeChild(curItem);
            const key = curItem.getAttribute('key');
            _files = _files.filter(item => item.key !== key)
            if (_files.length === 0) {
                upload_list.style.display = 'none';
            }
        }
    });

    // 点击上传到服务器按钮
    upload_button_upload.addEventListener('click', async function () {
        if (checkIsDisable(upload_button_upload)) return;
        if (!_files.length) {
            alert('请先选择要上传的文件~~');
            return;
        }
        disableHandler(true);
        const upload_list_lis = Array.from(upload_list.querySelectorAll('li'));
        _files = _files.map(item => {
            const data = new FormData();
            data.append('file', item.file);
            data.append('filename', item.filename);
            const curLi = upload_list_lis.find(li => li.getAttribute('key') === item.key);
            const curSpan = curLi ? curLi.querySelector('span:nth-last-child(1)') : null;
            return instance.post('/upload_single', data, {
                onUploadProgress(evt) {
                    if (curSpan) {
                        curSpan.innerHTML = `${(evt.loaded / evt.total * 100).toFixed(2)}%`;
                    }
                }
            }).then(res => {
                if (+res.code === 0) {
                    if (curSpan) {
                        curSpan.innerHTML = "100%";
                    }
                    return;
                }
                return Promise.reject(res.codeText);
            })
        });
        try {
            await Promise.all(_files)
            alert('恭喜，所有文件上传成功~~')
        } catch (err) {
            alert('很遗憾，上传过程中出现问题，请稍后再试~~')
        } finally {
            disableHandler(false);
            _files = [];
            upload_list.innerHTML = '';
            upload_list.style.display = 'none';
        }
    })
})();

// 拖拽上传
(function () {
    const upload = document.querySelector('#upload6'),
        upload_inp = upload.querySelector('.upload_inp'),
        upload_submit = upload.querySelector('.upload_submit'),
        upload_mark = upload.querySelector('.upload_mark');

    let isUploading = false;

    upload_submit.addEventListener('click', function () {
        upload_inp.click();
    });

    upload_inp.addEventListener('change', function () {
        const file = upload_inp.files[0];
        if (!file) return;
        uploadFile(file);
    });

    upload.addEventListener('dragover', function (evt) {
        evt.preventDefault();
    });

    upload.addEventListener('drop', function (evt) {
        evt.preventDefault();
        const file = evt.dataTransfer.files[0];
        if (!file) return;
        uploadFile(file);
    });

    async function uploadFile(file) {
        if (isUploading) return;
        isUploading = true;
        upload_mark.style.display = 'block';
        try {
            const data = new FormData();
            data.append('file', file);
            data.append('filename', file.name);
            const res = await instance.post('/upload_single', data);
            if (+res.code === 0) {
                alert(`文件上传成功~~，请基于 ${res.servicePath} 访问这个资源~~`);
                return;
            }
            throw res.codeText;
        } catch (err) {
            alert("文件上传失败，请稍后重试");
        } finally {
            isUploading = false;
            upload_mark.style.display = 'none';
        }
    }
})();

// 大文件上传
(function () {
    const upload = document.querySelector('#upload7'),
        upload_inp = upload.querySelector('.upload_inp'),
        upload_button_select = upload.querySelector('.upload_button.select'),
        upload_progress = upload.querySelector('.upload_progress'),
        upload_progress_value = upload_progress.querySelector('.value');

    // 点击上传按钮，触发上传文件 INPUT 框选择文件的行为
    upload_button_select.addEventListener('click', function () {
        if (checkIsDisable(this)) return;
        upload_inp.click();
    });

    // 监听用户选择文件的操作
    upload_inp.addEventListener('change', function () {
        const file = upload_inp.files[0];
        if (!file) return;
        upload_button_select.classList.add('loading');
        upload_progress.style.display = 'block';

        function reset() {
            upload_button_select.classList.remove('loading');
            upload_progress.style.display = 'none';
            upload_progress_value.style.width = '0%';
        }

        // 获取文件的 hash
        readAsBuffer(file).then(({hash, suffix}) => {
            // 获取已经上传的切片信息
            let already = [];
            instance.get('/upload_already', {params: {HASH: hash}}).then(res => {
                if (+res.code === 0) {
                    already = res.fileList;
                    // 实现文件切片处理（固定数量 & 固定大小）
                    let max = 1024 * 100, count = Math.ceil(file.size / max);
                    if (count > 100) {
                        count = 100;
                        max = file.size / count;
                    }
                    // 开始处理
                    let index = 0, chunks = [];
                    while (index < count) {
                        chunks.push({
                            file: file.slice(index * max, (index + 1) * max),
                            filename: `${hash}_${index + 1}.${suffix}`
                        });
                        index++;
                    }

                    index = 0;

                    // 上传成功的处理（管控进度条；当所有切片上传成功，发起合并切片请求）
                    function complete() {
                        index++;
                        upload_progress_value.style.width = `${index / count * 100}%`;
                        if (index < count) return;
                        upload_progress_value.style.width = '100%';
                        instance.post('/upload_merge', {HASH: hash, count}, {
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded'
                            }
                        }).then(res => {
                            if (+res.code === 0) {
                                alert(`文件上传成功~~，请基于 ${res.servicePath} 访问这个资源~~`);
                                reset();
                                return;
                            }
                            return Promise.reject(res.codeText);
                        }).catch(err => {
                            alert('文件切片合并失败~~');
                            reset();
                        });
                    }

                    const uploadTasks = [];
                    // 开始上传切片
                    for (const chunk of chunks) {
                        // 已经上传的切片无需再上传了
                        if (already.length && already.includes(chunk.filename)) {
                            complete();
                        } else {
                            const data = new FormData();
                            data.append('file', chunk.file);
                            data.append('filename', chunk.filename);
                            uploadTasks.push(instance.post('/upload_chunk', data).then(res => {
                                if (+res.code === 0) {
                                    complete();
                                    return;
                                }
                                return Promise.reject(res.codeText);
                            }).catch(err => {
                                // console.log('当前切片上传失败~~');
                                return Promise.reject(err);
                            }));
                        }
                    }

                    Promise.all(uploadTasks).catch(err => {
                        alert('文件上传失败，请稍后重试~~');
                        reset();
                    });
                    return;
                }
                return Promise.reject(res.codeText);
            }).catch((err) => {
                alert('文件上传失败，请稍后重试~~');
                reset();
            });
        }).catch((err) => {
            alert('文件读取失败~~');
            reset();
        });
    });
})();
