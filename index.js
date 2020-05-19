const plsqlLib= require('./oracle-plsql')

module.exports = function plsql(app, conf) {
  plsqlLib.init(conf)

  app.get('/rest/plsql/:pkg', plsqlLib.readAll)
  app.get('/rest/plsql/:pkg/:id', plsqlLib.read)
  app.post('/rest/plsql/:pkg', plsqlLib.create)
  app.put('/rest/plsql/:pkg/:id', plsqlLib.update)
  app.delete('/rest/plsql/:pkg/:id', plsqlLib.delete)
  app.post('/rest/plsql/pls/:pkg/:method', plsqlLib.method)

  return function (req, res, next) {
    next()
  }
}
