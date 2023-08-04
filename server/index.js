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
          fs.unlinkSync(file.path);
          res.send({
            code: 0,
            codeText: 'upload success',
            originalFilename: filename,
            servicePath: path.replace(__dirname, HOSTNAME)
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
        servicePath: path.replace(__dirname, HOSTNAME)
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
    let { fields, files } = await multipartyUpload(req);
    let file = (files.file && files.file[0]) || {},
      filename = (fields.filename && fields.filename[0]) || '',
      path = `${uploadDir}/${filename}`,
      isExists = false;
    // 检测是否存在
    isExists = await exists(path);
    if (isExists) {
      res.send({
        code: 0,
        codeText: 'file exists',
        originalFilename: filename,
        servicePath: path.replace(__dirname, HOSTNAME)
      });
      return;
    }
    writeFile(res, path, file, filename, true);
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
    path;
  file = decodeURIComponent(file);
  file = file.replace(/^data:image\/\w+;base64,/, '');
  file = Buffer.from(file, 'base64');
  spark.append(file);
  path = `${uploadDir}/${spark.end()}.${suffix}`;
  await delay();
  // 检测是否存在
  isExists = await exists(path);
  if (isExists) {
    res.send({
      code: 0,
      codeText: 'file exists',
      originalFilename: filename,
      servicePath: path.replace(__dirname, HOSTNAME)
    });
    return;
  }
  writeFile(res, path, file, filename, false);
});

// 大文件切片上传 & 合并切片
const merge = function (HASH, count) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    let path = `${uploadDir}/${HASH}`,
      fileList = [],
      suffix,
      isExists;
    isExists = await exists(path);
    if (!isExists) {
      reject('HASH path is not found');
      return;
    }
    fileList = fs.readdirSync(path);
    if (fileList.length < count) {
      reject('the slice has not been uploaded');
      return;
    }
    fileList
      .sort((a, b) => {
        let reg = /_(\d+)/;
        return reg.exec(a)[1] - reg.exec(b)[1];
      })
      .forEach((item) => {
        !suffix ? (suffix = /\.([0-9a-zA-Z]+)$/.exec(item)[1]) : null;
        fs.appendFileSync(`${uploadDir}/${HASH}.${suffix}`, fs.readFileSync(`${path}/${item}`));
        fs.unlinkSync(`${path}/${item}`);
      });
    fs.rmdirSync(path);
    resolve({
      path: `${uploadDir}/${HASH}.${suffix}`,
      filename: `${HASH}.${suffix}`
    });
  });
};
app.post('/upload_chunk', async (req, res) => {
  try {
    let { fields, files } = await multipartyUpload(req);
    let file = (files.file && files.file[0]) || {},
      filename = (fields.filename && fields.filename[0]) || '',
      path = '',
      isExists = false;
    // 创建存放切片的临时目录
    let [, HASH] = /^([^_]+)_(\d+)/.exec(filename);
    path = `${uploadDir}/${HASH}`;
    !fs.existsSync(path) ? fs.mkdirSync(path) : null;
    // 把切片存储到临时目录中
    path = `${uploadDir}/${HASH}/${filename}`;
    isExists = await exists(path);
    if (isExists) {
      res.send({
        code: 0,
        codeText: 'file exists',
        originalFilename: filename,
        servicePath: path.replace(__dirname, HOSTNAME)
      });
      return;
    }
    writeFile(res, path, file, filename, true);
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
    let { filename, path } = await merge(HASH, count);
    res.send({
      code: 0,
      codeText: 'merge success',
      originalFilename: filename,
      servicePath: path.replace(__dirname, HOSTNAME)
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
  let path = `${uploadDir}/${HASH}`,
    fileList = [];
  try {
    fileList = fs.readdirSync(path);
    fileList = fileList.sort((a, b) => {
      let reg = /_(\d+)/;
      return reg.exec(a)[1] - reg.exec(b)[1];
    });
    res.send({
      code: 0,
      codeText: '',
      fileList: fileList
    });
  } catch (err) {
    res.send({
      code: 0,
      codeText: '',
      fileList: fileList
    });
  }
});

app.use(express.static('./upload'));

app.use((req, res) => {
  res.status(404);
  res.send('NOT FOUND');
});
