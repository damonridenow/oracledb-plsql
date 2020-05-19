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

/*helper per estrarre il risultato OUT CLOB
 TODO : riuscire a usare questa anche per il method new */
//err_msg = { msg : "method err"
//            sql : sql,
//            path : req.path,
//            body : JSON.stringify(req.body)
// }
var extract_result= function (err, result, err_msg, res, connection)
{
   if (err)
   {
      console.error(new Date(), "method err 2 " + err.message, err_msg.sql, err_msg.path, err_msg.body);
      res.status(500).send({ message:err.message, sql:err_msg.sql });
   }
   if (result && result.outBinds && result.outBinds.ret)
   {
      var lob = result.outBinds.ret;

      var clob_string = '';
      lob.setEncoding('utf8');

      lob.on('data', function(chunk) { clob_string += chunk; });

      lob.on('close', function(err)
      {
         if (err)
         {
            console.error(err.message);
            doRelease(connection);
            return;
         }
         doRelease(connection);
         res.status(200).send(JSON.parse(clob_string));
      });

      lob.on('error', function(err)
      {
         console.log('lob error event: ' + err.message, err_msg.sql, err_msg.path);
         res.status(500).send({ message:err.message, sql:err_msg.sql });
         doRelease(connection);
      });
   }
}
/*/helper per estrarre il risultato OUT CLOB*/

/*helpers per uso di clob IN*/
var doconnect = function(cb)
{
   oracledb.getConnection(oracle_cn, cb);
}

var docreatetemplob = function (conn, cb)
{
   conn.createLob(oracledb.CLOB, function(err, templob)
   {
      if (err) return cb(err);

      return cb(null, conn, templob);
   });
}

var doloadtemplob = function (conn, templob, cb)
{
   templob.on('close', function() { });

   templob.on('error', function(err)
   {
      console.log("templob.on 'error' event");
      return cb(err);
   });

   templob.on('finish', function()
   {
      return cb(null, conn, templob);
   });

   var Readable = require('stream').Readable
   var s = new Readable;
   s.push(JSON.stringify(requestBody));
   s.push(null);
   s.pipe(templob);
}

var doclosetemplob = function (conn, templob, clob_string, cb)
{
   templob.close(function (err)
   {
      if (err) return cb(err);

      return cb(null, conn, clob_string);
   });
}

var doreturn = function (conn, clob_string, cb)
{
    cb(null, conn, clob_string);
}
/*/helpers per uso di clob IN*/

exports.readAll = function (req, res)
{
   var sql = "BEGIN "+PkgGateway+".read(:par, :pkg, :user, :ret); END;";
   oracledb.getConnection(oracle_cn,
      function (err, connection)
      {
         if (err)
         {
            console.error(new Date(), "readAll err 1 " + err.message, sql, req.path);
            return ({ error: err });
         }
         connection.execute(
            sql,
            {
               par: {
                  val: JSON.stringify(req.query),
                  dir: oracledb.BIND_IN,
                  type: oracledb.STRING,
                  maxSize: 32000
               },
               pkg: { val: req.params.pkg, dir: oracledb.BIND_IN, type: oracledb.STRING, maxSize: 32000 },
               user: { val: formatUserFunction(req.user), dir: oracledb.BIND_IN, type: oracledb.STRING, maxSize: 32000 },
               ret: {dir: oracledb.BIND_OUT, type: oracledb.CLOB}
            },
            function (err, result)
            {
               extract_result(err, result, { msg : "readAll err",
                  sql : sql,
                  path : req.path,
                  body : JSON.stringify(req.body)
               }, res, connection);
         });
      });
}

exports.read = function (req, res)
{
   var sql = "BEGIN "+PkgGateway+".read(:key, :pkg, :user, :ret); END;";
   oracledb.getConnection(oracle_cn,
      function (err, connection)
      {
         if (err)
         {
            console.error(new Date(), "read err 1 " + err.message, sql, req.path);
            return ({ error: err });
         }

         connection.execute(
            sql,
            {
               key: {val: parseInt(req.params.id), dir: oracledb.BIND_IN, type: oracledb.NUMBER},
               pkg: { val: req.params.pkg, dir: oracledb.BIND_IN, type: oracledb.STRING, maxSize: 32000 },
               user: { val: formatUserFunction(req.user), dir: oracledb.BIND_IN, type: oracledb.STRING, maxSize: 32000 },
               ret: { dir: oracledb.BIND_OUT, type: oracledb.CLOB }
            },
            function (err, result)
            {
               extract_result(err, result, { msg : "read err",
                  sql : sql,
                  path : req.path,
                  body : JSON.stringify(req.body)
               }, res, connection);
            });
      });
}

exports.create = function (req, res)
{
   var async = require('async');
   var sql = "BEGIN " + PkgGateway + ".create_(:obj, :pkg, :user, :ret); END;";

   requestBody = req.body;

   var docreate = function (conn, templob, cb)
   {
      conn.execute(
         sql,
         {
            obj: {val: JSON.stringify(req.body), dir: oracledb.BIND_IN, type: oracledb.STRING},
            pkg: {val: req.params.pkg, dir: oracledb.BIND_IN, type: oracledb.STRING, maxSize: 4000},
            user: { val: formatUserFunction(req.user), dir: oracledb.BIND_IN, type: oracledb.STRING, maxSize: 32000 },
            ret: {dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 32000}
         },
         function (err, result)
         {
            if (err) return cb(err);

            if (result && result.outBinds && result.outBinds.ret)
            {
               var clob_string = JSON.parse(result.outBinds.ret);
               return cb(null, conn, templob, clob_string);
            }
         });
   }

   async.waterfall(
      [
         doconnect,
         docreatetemplob,
         doloadtemplob,
         docreate,
         doclosetemplob,
         doreturn
      ],
      function (err, conn, clob_string)
      {
         if (err)
         {
            console.error("In waterfall error cb: ==>", err, JSON.stringify(req.body), req.params.pkg, "<==");
            res.status(500).send({message: err.message, sql: sql})
         }

         if (conn) doRelease(conn);

         res.status(200).send(clob_string);
      });
}

exports.createOld = function (req, res)
{
   var sql = "BEGIN " + PkgGateway + ".create_(:obj, :pkg, :user, :ret); END;";

   oracledb.getConnection(oracle_cn,
      function (err, connection)
      {
         if (err)
         {
            console.error(new Date(), "create err 1 " + err.message, sql, req.path);
            return ({error: err});
         }

         connection.execute(
            sql,
            {
               obj: {val: JSON.stringify(req.body), dir: oracledb.BIND_IN, type: oracledb.STRING, maxSize: 32000},
               pkg: {val: req.params.pkg, dir: oracledb.BIND_IN, type: oracledb.STRING, maxSize: 32000},
               user: { val: formatUserFunction(req.user), dir: oracledb.BIND_IN, type: oracledb.STRING, maxSize: 32000 },
               ret: {dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 32000}
            },
            function (err, result)
            {
               if (err)
               {
                  console.error(new Date(), "create err 2 " + err.message, sql, req.path, JSON.stringify(req.body));
                  res.status(500).send({message: err.message, sql: sql});
                  console.log(sql);
               }
               if (result && result.outBinds && result.outBinds.ret)
               {
                  var r = JSON.parse(result.outBinds.ret);
                  res.send(r);
               }
               doRelease(connection);
            });
      });
}

exports.update= function(req, res)
{
   var sql = "BEGIN "+PkgGateway+".update_(:key, :obj, :pkg, :user, :ret); END;";
   oracledb.getConnection(oracle_cn,
      function(err, connection)
      {
         if (err)
         {
            console.error(new Date(), "update err 1 " + err.message, sql, req.path);
            return({error:err});
         }
         connection.execute(
            sql,
            {  key: { val:parseInt(req.params.id), dir: oracledb.BIND_IN, type: oracledb.NUMBER } ,
               obj : { val:JSON.stringify(req.body), dir: oracledb.BIND_IN, type: oracledb.STRING, maxSize:32000 },
               pkg: { val: req.params.pkg, dir: oracledb.BIND_IN, type: oracledb.STRING, maxSize: 32000 },
               user: { val: formatUserFunction(req.user), dir: oracledb.BIND_IN, type: oracledb.STRING, maxSize: 32000 },
               ret: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 32000 }
            },
            function (err, result)
            {
               if (err)
               {
                  console.error(new Date(), "update err 2 " + err.message, sql, req.path, req.params.id, JSON.stringify(req.body));
                  res.status(500).send({ message:err.message, sql:sql });
                  console.log(sql);
               }

               if (result && result.outBinds && result.outBinds.ret)
               {
                  var r = JSON.parse(result.outBinds.ret);
                  res.send(r);
               }

               doRelease(connection);
            });
      });
}

exports.delete= function(req, res)
{
   var sql = "begin "+PkgGateway+".delete_(:key, :pkg, :user); end;";
   oracledb.getConnection(oracle_cn,
      function(err, connection)
      {
          if (err)
          {
             console.error(new Date(), "delete err 1 " + err.message, sql, req.path);
             return({error:err});
          }
         connection.execute(
           sql,
           {  key: { val:parseInt(req.params.id), dir: oracledb.BIND_IN, type: oracledb.NUMBER },
              pkg: { val: req.params.pkg, dir: oracledb.BIND_IN, type: oracledb.STRING, maxSize: 32000 },
              user: { val: formatUserFunction(req.user), dir: oracledb.BIND_IN, type: oracledb.STRING, maxSize: 32000 }
           },
           function (err, result)
           {
             if (err)
             {
                console.error(new Date(), "delete err 2 " + err.message, sql, req.path, req.params.id);
                res.status(500).send({ message:err.message, sql:sql });
                console.log(sql);
             }
             else
                res.send();

             doRelease(connection);
           });
      });
}

exports.method = function (req, res)
{
    //ho fatto due metodi diversi a seconda del parametro che gli inviamo : se serve usiamo un CLOB
    //console.log('metodo : lunghezza body', JSON.stringify(req.body).length);
    if (JSON.stringify(req.body).length > 30000)
        methodNew(req, res);
    else
        methodOld(req, res);
}

var methodOld= function(req, res)
{
   var sql = "BEGIN "+PkgGateway+".method(:par, :pkg, :user, :ret); END;";

   oracledb.getConnection(oracle_cn,
      function (err, connection)
      {
         if (err)
         {
            console.error(new Date(), "method err 1 " + err.message, sql, req.path);
            return ({error: err});
         }
         connection.execute(
            sql,
            {
               par: {
                  val: JSON.stringify(req.body),
                  dir: oracledb.BIND_IN,
                  type: oracledb.STRING,
                  maxSize: 32000
               },
               pkg: { val: req.params.pkg + "." + req.params.method, dir: oracledb.BIND_IN, type: oracledb.STRING, maxSize: 32000 },
               user: { val: formatUserFunction(req.user), dir: oracledb.BIND_IN, type: oracledb.STRING, maxSize: 32000 },
               ret: {dir: oracledb.BIND_OUT, type: oracledb.CLOB}
            },
            function (err, result)
            {
               extract_result(err, result, { msg : "method err",
                  sql : sql,
                  path : req.path,
                  body : JSON.stringify(req.body)
               }, res, connection);
            });
      });
}

var methodNew = function (req, res)
{
   var async = require('async');
   var sql = "BEGIN "+PkgGateway+".method(:par, :pkg, :user); END;";

   requestBody = req.body;

   var domethod = function (conn, templob, cb)
   {
      conn.execute(
         sql,
         {
            par : { val: templob, dir: oracledb.BIND_INOUT, type: oracledb.CLOB },
            pkg: { val: req.params.pkg + "." + req.params.method, dir: oracledb.BIND_IN, type: oracledb.STRING, maxSize: 32000 },
            user: { val: formatUserFunction(req.user), dir: oracledb.BIND_IN, type: oracledb.STRING, maxSize: 32000 }
         },
         function (err, result)
         {
            if (err) return cb(err);

            if (result && result.outBinds && result.outBinds.par)
            {
               var lob = result.outBinds.par;

               var clob_string = '';
               lob.setEncoding('utf8');

               lob.on('data', function (chunk) {
                  clob_string += chunk;
               });

               lob.on('close', function (err) {
                  if (err)
                  {
                     console.error(err.message);
                     return cb(err);
                  }
                  return cb(null, conn, templob, clob_string);
               });

               lob.on('error', function (err)
               {
                  return cb(err);
               });
            }
         });
   };

   async.waterfall(
      [
         doconnect,
         docreatetemplob,
         doloadtemplob,
         domethod,
         doclosetemplob,
         doreturn
      ],
      function (err, conn, clob_string)
      {
         if (err)
         {
            console.error("In waterfall error cb: ==>", err, "<==");
            res.status(500).send({message: err.message, sql: sql})
         }

         if (conn) doRelease(conn);

         res.status(200).send(clob_string);
      });
}

exports.testConnection = function(req, res)
{
  return({message:'test ok', r:req.params});
}
