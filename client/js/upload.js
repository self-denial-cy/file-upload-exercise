// 验证元素是否可用
function checkIsDisable(ele) {
    const classList = ele.classList
    return classList.contains('disable') || classList.contains('loading')
}

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

    // 将选择的文件读取为 BASE64
    function readAsBASE64(file) {
        return new Promise((resolve, reject) => {
            const fileReader = new FileReader
            fileReader.readAsDataURL(file)
            fileReader.onload = ({
                                     target
                                 }) => {
                resolve(target.result)
            }
            fileReader.onerror = (err) => {
                reject(err)
            }
        })
    }

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
