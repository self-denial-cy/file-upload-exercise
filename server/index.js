const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const multiparty = require('multiparty');
const SparkMD5 = require('spark-md5');

const app = express(),
  PORT = 8888,
  HOST = 'http://127.0.0.1',
  HOSTNAME = `${HOST}:${PORT}`;
app.listen(PORT, () => {
  console.log(
    `THE WEB SERVICE IS CREATED SUCCESSFULLY AND IS LISTENING TO THE PORT: ${PORT}, YOU CAN VISIT: ${HOSTNAME}`
  );
});

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  req.method === 'OPTIONS' ? res.send('CURRENT SERVICE SUPPORT CROSS DOMAIN REQUEST') : next();
});

app.use(
  bodyParser.urlencoded({
    extended: false,
    limit: '1024mb'
  })
);

const pathTransform = function (str) {
  return str.split(path.sep).join('/');
};

const delay = function (interval) {
  typeof interval !== 'number' ? (interval = 1000) : null;
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, interval);
  });
};

// 检查文件是否已存在
const exists = function (path) {
  return new Promise((resolve) => {
    fs.access(path, fs.constants.F_OK, (err) => {
      if (err) {
        resolve(false);
        return;
      }
      resolve(true);
    });
  });
};

// 创建文件并写入到指定的目录 & 返回客户端结果
const writeFile = function (res, path, file, filename, stream) {
  return new Promise((resolve, reject) => {
    if (stream) {
      try {
        let readStream = fs.createReadStream(file.path),
          writeStream = fs.createWriteStream(path);
        readStream.pipe(writeStream);
        readStream.on('end', () => {
          resolve();
          fs.unlinkSync(file.path); // 删除临时文件
          res.send({
            code: 0,
            codeText: 'upload success',
            originalFilename: filename,
            servicePath: pathTransform(path.replace(uploadDir, HOSTNAME))
          });
        });
      } catch (err) {
        reject(err);
        res.send({
          code: 1,
          codeText: err
        });
      }
      return;
    }
    fs.writeFile(path, file, (err) => {
      if (err) {
        reject(err);
        res.send({
          code: 1,
          codeText: err
        });
        return;
      }
      resolve();
      res.send({
        code: 0,
        codeText: 'upload success',
        originalFilename: filename,
        servicePath: pathTransform(path.replace(uploadDir, HOSTNAME))
      });
    });
  });
};

// 基于 multiparty 插件实现文件上传处理 & form-data 解析
const uploadDir = path.join(__dirname, './upload');
const multipartyUpload = function (req, auto) {
  typeof auto !== 'boolean' ? (auto = false) : null;
  const config = {
    maxFieldsSize: 200 * 1024 * 1024 // 200MB
  };
  if (auto) config.uploadDir = uploadDir;
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    await delay();
    new multiparty.Form(config).parse(req, (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }
      console.log(fields, files);
      resolve({
        fields,
        files
      });
    });
  });
};

// 单文件上传处理「FORM-DATA」
app.post('/upload_single', async (req, res) => {
  try {
    let { files } = await multipartyUpload(req, true);
    let file = (files.file && files.file[0]) || {};
    res.send({
      code: 0,
      codeText: 'upload success',
      originalFilename: file.originalFilename,
      servicePath: pathTransform(file.path.replace(uploadDir, HOSTNAME))
    });
  } catch (err) {
    res.send({
      code: 1,
      codeText: err
    });
  }
});
app.post('/upload_single_name', async (req, res) => {
  try {
    let { fields, files } = await multipartyUpload(req); // 先上传到 Temp 目录
    let file = (files.file && files.file[0]) || {},
      filename = (fields.filename && fields.filename[0]) || '',
      _path = path.join(uploadDir, filename),
      isExists = false;
    // 检测是否存在
    isExists = await exists(_path);
    if (isExists) {
      res.send({
        code: 0,
        codeText: 'file exists',
        originalFilename: filename,
        servicePath: pathTransform(_path.replace(uploadDir, HOSTNAME))
      });
      return;
    }
    writeFile(res, _path, file, filename, true);
  } catch (err) {
    res.send({
      code: 1,
      codeText: err
    });
  }
});

// 单文件上传处理「BASE64」
app.post('/upload_single_base64', async (req, res) => {
  let file = req.body.file,
    filename = req.body.filename,
    spark = new SparkMD5.ArrayBuffer(),
    suffix = /\.([0-9a-zA-Z]+)$/.exec(filename)[1],
    isExists = false,
    _path;
  file = decodeURIComponent(file);
  file = file.replace(/^data:image\/\w+;base64,/, '');
  file = Buffer.from(file, 'base64');
  spark.append(file);
  _path = path.join(uploadDir, `${spark.end()}.${suffix}`);
  await delay();
  // 检查是否已存在
  isExists = await exists(_path);
  if (isExists) {
    res.send({
      code: 0,
      codeText: 'file exists',
      originalFilename: filename,
      servicePath: pathTransform(_path.replace(uploadDir, HOSTNAME))
    });
    return;
  }
  writeFile(res, _path, file, filename, false);
});

// 大文件切片上传 & 合并切片
const merge = function (HASH, count) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    let _path = path.join(uploadDir, HASH),
      fileList = [],
      suffix,
      isExists;
    isExists = await exists(_path);
    if (!isExists) {
      reject('HASH path is not found');
      return;
    }
    fileList = fs.readdirSync(_path);
    if (fileList.length < count) {
      reject('the slice has not been all uploaded');
      return;
    }
    fileList
      .sort((a, b) => {
        let reg = /_(\d+)/;
        return reg.exec(a)[1] - reg.exec(b)[1];
      })
      .forEach((item) => {
        !suffix ? (suffix = /\.([0-9a-zA-Z]+)$/.exec(item)[1]) : null;
        fs.appendFileSync(path.join(uploadDir, `${HASH}.${suffix}`), fs.readFileSync(path.join(_path, item))); // 合并切片信息「合并 Buffer 对象」
        fs.unlinkSync(path.join(_path, item)); // 同步删除
      });
    fs.rmdirSync(_path); // 同步删除
    resolve({
      path: path.join(uploadDir, `${HASH}.${suffix}`),
      filename: `${HASH}.${suffix}`
    });
  });
};
app.post('/upload_chunk', async (req, res) => {
  try {
    let { fields, files } = await multipartyUpload(req);
    let file = (files.file && files.file[0]) || {},
      filename = (fields.filename && fields.filename[0]) || '',
      _path = '',
      isExists = false;
    // 创建存放切片的临时目录
    let [, HASH] = /^([^_]+)_(\d+)/.exec(filename); // 从文件名中匹配出唯一 hash
    _path = path.join(uploadDir, HASH);
    !fs.existsSync(_path) ? fs.mkdirSync(_path) : null;
    // 把切片存储到临时目录中
    _path = path.join(uploadDir, HASH, filename);
    isExists = await exists(_path);
    if (isExists) {
      res.send({
        code: 0,
        codeText: 'file exists',
        originalFilename: filename,
        servicePath: pathTransform(_path.replace(uploadDir, HOSTNAME))
      });
      return;
    }
    writeFile(res, _path, file, filename, true);
  } catch (err) {
    res.send({
      code: 1,
      codeText: err
    });
  }
});
app.post('/upload_merge', async (req, res) => {
  let { HASH, count } = req.body;
  try {
    let { filename, path: _path } = await merge(HASH, count);
    res.send({
      code: 0,
      codeText: 'merge success',
      originalFilename: filename,
      servicePath: pathTransform(_path.replace(uploadDir, HOSTNAME))
    });
  } catch (err) {
    res.send({
      code: 1,
      codeText: err
    });
  }
});
app.get('/upload_already', async (req, res) => {
  let { HASH } = req.query;
  let _path = path.join(uploadDir, HASH),
    fileList = [];
  try {
    fileList = fs.readdirSync(_path);
    fileList = fileList.sort((a, b) => {
      let reg = /_(\d+)/;
      return reg.exec(a)[1] - reg.exec(b)[1];
    });
    res.send({
      code: 0,
      codeText: 'already upload',
      fileList: fileList
    });
  } catch (err) {
    // 若未读取到相关目录，说明从未上传过
    res.send({
      code: 0,
      codeText: 'already upload',
      fileList: fileList
    });
  }
});

app.use(express.static('./upload'));

app.use((req, res) => {
  res.status(404);
  res.send('NOT FOUND');
});
