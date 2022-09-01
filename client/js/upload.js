(function () {
  const upload = document.querySelector("#upload1"),
    upload_inp = upload.querySelector(".upload_inp"),
    upload_button_select = upload.querySelector(".upload_button.select"),
    upload_button_upload = upload.querySelector(".upload_button.upload"),
    upload_tip = upload.querySelector(".upload_tip"),
    upload_list = upload.querySelector(".upload_list");

  // 点击选择文件按钮，触发上传文件 INPUT 框选择文件的行为
  upload_button_select.addEventListener("click", function () {
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
  });

  // 移除按钮的点击处理
  upload_list.addEventListener("click", function (evt) {
    const target = evt.target;
    if (target.tagName === "EM") {
      upload_tip.style.display = "block";
      upload_list.style.display = "none";
      upload_list.innerHTML = ``;
    }
  });
})();
