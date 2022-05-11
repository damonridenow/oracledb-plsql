const plsqlLib= require('./oracle-plsql')

module.exports = {
  plsql: function (app, conf) {
    plsqlLib.init(conf)

    app.get('/rest/plsql/:pkg', plsqlLib.readAllRoute)
    app.get('/rest/plsql/:pkg/:id', plsqlLib.readRoute)
    app.post('/rest/plsql/:pkg', plsqlLib.createRoute)
    app.put('/rest/plsql/:pkg/:id', plsqlLib.updateRoute)
    app.delete('/rest/plsql/:pkg/:id', plsqlLib.deleteRoute)
    app.post('/rest/plsql/pls/:pkg/:method', plsqlLib.methodRoute)

    return function (req, res, next) {
      next()
    }
  },
  readStringKey: plsqlLib.readStringKey,
  read: plsqlLib.read,
  readAll: plsqlLib.readAll,
  create: plsqlLib.create,
  update: plsqlLib.update,
  delete: plsqlLib.delete,
  method: plsqlLib.method
}