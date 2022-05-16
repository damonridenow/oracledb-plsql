const oracledb = require('oracledb')// ,    PkgGateway = 'NODEORACLE_GATEWAY'

// variabili di init
let oracle_cn, formatUserFunction, PkgGateway

exports.init = function (conf) {
  if (!conf.oracle_cn)
    throw 'No connection provided'

  if (!conf.pkgGateway)
    throw 'No pkg gateway provided'

  oracle_cn = conf.oracle_cn
  PkgGateway = conf.pkgGateway
  if (conf.formatUserFunction)
    formatUserFunction = conf.formatUserFunction
  else
    formatUserFunction = function (u) { return u }
}

oracledb.autoCommit = true;
oracledb.fetchAsString = [ oracledb.CLOB ];

var requestBody;

function doRelease(connection)
{
   connection.release(
      function(err)
      {
         if (err)
            console.error('release() error', err.message);
      });
}

/*helper per estrarre il risultato OUT CLOB */

const extract_result_new = function (result, connection)
{
   return new Promise((resolve, reject) =>
   {
      if (result && result.outBinds && result.outBinds.ret)
      {
         var lob = result.outBinds.ret;

         var clob_string = '';
         lob.setEncoding('utf8');

         lob.on('data', (chunk) => { clob_string += chunk; })

         lob.on('close', (err) =>
         {
            if (err)
            {
               // console.error(err.message);
               doRelease(connection);
               reject(err)
            }
            doRelease(connection);
            // res.status(200).send(JSON.parse(clob_string));
            resolve(JSON.parse(clob_string))
         });

         lob.on('error', (err) =>
         {
            // console.log('lob error event: ' + err.message, err_msg.sql, err_msg.path);
            // res.status(500).send({ message:err.message, sql:err_msg.sql });
            doRelease(connection);
            reject(err)
         });
      }
   })
   
}
/*/helper per estrarre il risultato OUT CLOB*/

/*helpers per uso di clob IN*/
const doloadtemplobNew = (templob) =>
{
   return new Promise((resolve, reject) => {
      templob.on('close', function() { })

      templob.on('error', function(err)
      {
         console.log('templob.on "error" event')
         reject(err)
      });
   
      templob.on('finish', function()
      {
         resolve(templob)
      });
   
      var Readable = require('stream').Readable
      var s = new Readable;
      s.push(JSON.stringify(requestBody));
      s.push(null);
      s.pipe(templob);
   })
}
/*/helpers per uso di clob IN*/

exports.readAllRoute = async function (req, res) {
   try {
      const result = await exports.readAll(req.query, req.params.pkg, req.user, req.path, req.body)
      res.status(200).send(result)
   } catch (err) {
      res.status(500).send(err);
   }
}

exports.readAll = async function (query, pkg, user, path, body)
{
   const sql = 'BEGIN ' + PkgGateway + '.read(:par, :pkg, :user, :ret); END;';
   try {
      const connection = await oracledb.getConnection(oracle_cn)
      try {
         const result = await connection.execute(
            sql,
            {
               par: {
                  val: JSON.stringify(query),
                  dir: oracledb.BIND_IN,
                  type: oracledb.STRING,
                  maxSize: 32000
               },
               pkg: { val: pkg, dir: oracledb.BIND_IN, type: oracledb.STRING, maxSize: 32000 },
               user: { val: formatUserFunction(user), dir: oracledb.BIND_IN, type: oracledb.STRING, maxSize: 32000 },
               ret: {dir: oracledb.BIND_OUT, type: oracledb.CLOB}
            }
         )

         const parsedResult =  await extract_result_new(result, connection)
         return parsedResult

      } catch(err) {
         console.error(new Date(), "readAll err 2 " + err.message, sql, path, JSON.stringify(body));
         throw { message: err.message, sql: sql }
      }
   } catch(err) {
      console.error(new Date(), "readAll err 1 " + err.message, sql, path)
      throw { error: err }
   }
}

exports.readRoute = async function (req, res) {
   try {
      const result = await exports.read(req.params.id, req.params.pkg, req.user, req.path, req.body)
      res.status(200).send(result)
   } catch (err) {
      res.status(500).send(err);
   }
}

exports.read = async function (id, pkg, user, path, body)
{
   const sql = 'BEGIN ' + PkgGateway + '.read(:key, :pkg, :user, :ret); END;'
   const connection = await oracledb.getConnection(oracle_cn)
   try {
      const result = await connection.execute(
         sql,
         {
            key: {val: parseInt(id), dir: oracledb.BIND_IN, type: oracledb.NUMBER},
            pkg: { val: pkg, dir: oracledb.BIND_IN, type: oracledb.STRING, maxSize: 32000 },
            user: { val: formatUserFunction(user), dir: oracledb.BIND_IN, type: oracledb.STRING, maxSize: 32000 },
            ret: { dir: oracledb.BIND_OUT, type: oracledb.CLOB }
         })

         const parsedResult =  await extract_result_new(result, connection)
         return parsedResult
   } catch(err) {
      const objErr = { stack: err.stack, message: err.message }
      console.error(new Date(), objErr, sql, path, JSON.stringify(body));
      throw objErr
   }
}

exports.readStringKey = async function (key, pkg, user, path, body)
{
   const sql = 'BEGIN ' + PkgGateway + '.read(:key, :pkg, :user, :ret); END;'
   try {
      const connection = await oracledb.getConnection(oracle_cn)
      const result = await connection.execute(
         sql,
         {
            key: { val: JSON.stringify(key), dir: oracledb.BIND_IN, type: oracledb.STRING, maxSize: 32000 },
            pkg: { val: pkg, dir: oracledb.BIND_IN, type: oracledb.STRING, maxSize: 32000 },
            user: { val: formatUserFunction(user), dir: oracledb.BIND_IN, type: oracledb.STRING, maxSize: 32000 },
            ret: { dir: oracledb.BIND_OUT, type: oracledb.CLOB }
         })

         const parsedResult =  await extract_result_new(result, connection)
         return parsedResult
   } catch(err) {
      const objErr = { stack: err.stack, message: err.message }
      console.error(new Date(), objErr, sql, path, JSON.stringify(body));
      throw objErr
   }
}

exports.createRoute = async function (req, res) {
   try {
      const result = await exports.create(req.params.pkg, req.user, req.body)
      res.status(200).send(result)
   } catch (err) {
      res.status(500).send(err);
   }
}

exports.create = async function (pkg, user, body)
{
   const sql = 'BEGIN ' + PkgGateway + '.create_(:obj, :pkg, :user, :ret); END;'

   requestBody = body;

   try {
      const connection = await oracledb.getConnection(oracle_cn)
      const tempLob = await connection.createLob(oracledb.CLOB)
      const loadedTempBlob = await doloadtemplobNew(tempLob)

      const result = await connection.execute(sql,
         {
            obj: {val: JSON.stringify(body), dir: oracledb.BIND_IN, type: oracledb.STRING},
            pkg: {val: pkg, dir: oracledb.BIND_IN, type: oracledb.STRING, maxSize: 4000},
            user: { val: formatUserFunction(user), dir: oracledb.BIND_IN, type: oracledb.STRING, maxSize: 32000 },
            ret: {dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 32000}
         })

      if (result && result.outBinds && result.outBinds.ret)
      {
         var clob_string = JSON.parse(result.outBinds.ret)
      }

      await tempLob.close()
      return clob_string
   } catch(err) {
      const objErr = { stack: err.stack, message: err.message }
      console.error(new Date(), objErr, sql, JSON.stringify(body));
      throw objErr
   }
}

exports.updateRoute = async function (req, res) {
   try {
      const result = await exports.update(req.params.id, req.params.pkg, req.user, req.path, req.body)
      res.status(200).send(result)
   } catch (err) {
      res.status(500).send(err);
   }
}

exports.update = async function(id, pkg, user, path, body)
{
   const sql = 'BEGIN ' + PkgGateway + '.update_(:key, :obj, :pkg, :user, :ret); END;'
   try {
      const connection = await oracledb.getConnection(oracle_cn)
      const result = await connection.execute(
         sql,
         {  key: { val:parseInt(id), dir: oracledb.BIND_IN, type: oracledb.NUMBER } ,
            obj : { val:JSON.stringify(body), dir: oracledb.BIND_IN, type: oracledb.STRING, maxSize:32000 },
            pkg: { val: pkg, dir: oracledb.BIND_IN, type: oracledb.STRING, maxSize: 32000 },
            user: { val: formatUserFunction(user), dir: oracledb.BIND_IN, type: oracledb.STRING, maxSize: 32000 },
            ret: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 32000 }
         }
      )

      if (result && result.outBinds && result.outBinds.ret)
      {
         var r = JSON.parse(result.outBinds.ret)
         doRelease(connection)
         return(r)
      } else doRelease(connection)
      
   } catch(err) {
      const objErr = { stack: err.stack, message: err.message }
      console.error(new Date(), objErr, sql, path, JSON.stringify(body));
      throw objErr
   }   
}

exports.deleteRoute = async function (req, res) {
   try {
      const result = await exports.delete(req.params.id, req.params.pkg, req.user, req.path, req.body)
      res.status(200).send(result)
   } catch (err) {
      res.status(500).send(err);
   }
}

exports.delete = async function(id, pkg, user, path, body)
{
   const sql = 'BEGIN ' + PkgGateway + '.delete_(:key, :pkg, :user); END;';
   try {
      const connection = await oracledb.getConnection(oracle_cn)
      const result = await connection.execute(
         sql,
         {  key: { val:parseInt(id), dir: oracledb.BIND_IN, type: oracledb.NUMBER },
            pkg: { val: pkg, dir: oracledb.BIND_IN, type: oracledb.STRING, maxSize: 32000 },
            user: { val: formatUserFunction(user), dir: oracledb.BIND_IN, type: oracledb.STRING, maxSize: 32000 }
         }
      )
      
      return
   } catch(err) {
      const objErr = { stack: err.stack, message: err.message }
      console.error(new Date(), objErr, sql, path, JSON.stringify(body));
      throw objErr
   }
}

exports.methodRoute = async function (req, res) {
   try {
      const result = await exports.method(req.params.method, req.params.pkg, req.user, req.path, req.body)
      res.status(200).send(result)
   } catch (err) {
      res.status(500).send(err);
   }
}

exports.method = async function (method, pkg, user, path, body)
{
    //ho fatto due metodi diversi a seconda del parametro che gli inviamo : se serve usiamo un CLOB
    //console.log('metodo : lunghezza body', JSON.stringify(req.body).length);
    if (JSON.stringify(body).length > 30000)
        return methodNew(method, pkg, user, path, body);
    else
        return methodOld(method, pkg, user, path, body);
}

const methodOld = async function(method, pkg, user, path, body)
{
   const sql = 'BEGIN ' + PkgGateway + '.method(:par, :pkg, :user, :ret); END;';

   try {
      const connection = await oracledb.getConnection(oracle_cn)
      const result = await connection.execute(
         sql,
         {
            par: {
               val: JSON.stringify(body),
               dir: oracledb.BIND_IN,
               type: oracledb.STRING,
               maxSize: 32000
            },
            pkg: { val: pkg + '.' + method, dir: oracledb.BIND_IN, type: oracledb.STRING, maxSize: 32000 },
            user: { val: formatUserFunction(user), dir: oracledb.BIND_IN, type: oracledb.STRING, maxSize: 32000 },
            ret: {dir: oracledb.BIND_OUT, type: oracledb.CLOB}
         }
      )

      const parsedResult =  await extract_result_new(result, connection)
      return parsedResult
   } catch(err) {
      const objErr = { stack: err.stack, message: err.message }
      console.error(new Date(), objErr, sql, path, JSON.stringify(body));
      throw objErr
   }
}

var methodNew = async function (method, pkg, user, path, body)
{
   var async = require('async');
   var sql = 'BEGIN ' + PkgGateway + '.method(:par, :pkg, :user); END;';

   requestBody = body;
  
   try {
      const connection = await oracledb.getConnection(oracle_cn)
      const tempLob = await connection.createLob(oracledb.CLOB)
      const loadedTempBlob = await doloadtemplobNew(tempLob)

      const result = await connection.execute(sql,
         {
            par : { val: templob, dir: oracledb.BIND_INOUT, type: oracledb.CLOB },
            pkg: { val: pkg + '.' + method, dir: oracledb.BIND_IN, type: oracledb.STRING, maxSize: 32000 },
            user: { val: formatUserFunction(user), dir: oracledb.BIND_IN, type: oracledb.STRING, maxSize: 32000 }
         })

      if (result && result.outBinds && result.outBinds.ret)
      {
         var clob_string = JSON.parse(result.outBinds.ret)
      }

      await tempLob.close()
      return clob_string
   } catch(err) {
      const objErr = { stack: err.stack, message: err.message }
      console.error(new Date(), objErr, sql, path, JSON.stringify(body));
      throw objErr
   }
}

exports.testConnection = function(req, res)
{
  return({message:'test ok', r:req.params});
}
