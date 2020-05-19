# oracledb-plsql

Turns plsql packages into express api calls

## import and initialize

```
app.use(plsql(app, {
   oracle_cn : {
      user         : process.env.DB_USER,
      password     : process.env.DB_PWD,
      connectString: process.env.DB_CNTSTRING
   },
   pkgGateway: 'NODEORACLE_GATEWAY',
   formatUserFunction: user.formatUser
}))
```

## defined routes

```
app.get('/rest/plsql/:pkg', plsql.readAll)
app.get('/rest/plsql/:pkg/:id', plsql.read)
app.post('/rest/plsql/:pkg', plsql.create)
app.put('/rest/plsql/:pkg/:id', plsql.update)
app.delete('/rest/plsql/:pkg/:id', plsql.delete)
app.post('/rest/plsql/pls/:pkg/:method', plsql.method)
```

## plsql packages : the gateway

All the packages described here takes advantage of pljson (https://github.com/pljson/pljson)

```
create or replace package nodeoracle_gateway as

   g_utente      pljson;

--vecchie versioni, controllarne l'utilizzo
   function read(p_clob    in varchar2,
                 p_model   in varchar2,
                 p_context in varchar2)
     return varchar2;

   function read(p_id      in number,
                 p_model   in varchar2,
                 p_context in varchar2)
     return varchar2;

   procedure read(p_clob    in varchar2,
                  p_model   in varchar2,
                  p_context in varchar2,
                  p_out     out clob);
--/vecchie versioni
   procedure read(p_clob    in out clob,
                  p_model   in varchar2,
                  p_context in varchar2);

   procedure read(p_id      in number,
                  p_model   in varchar2,
                  p_context in varchar2,
                  p_out     out clob);

   procedure create_(p_clob    in clob,
                     p_model   in varchar2,
                     p_context in varchar2,
                     p_result  out clob);

   procedure update_(p_id      in number,
                     p_clob    in varchar2,
                     p_model   in varchar2,
                     p_context in varchar2,
                     p_result  out varchar2);

   procedure delete_(p_id      in number,
                     p_model   in varchar2,
                     p_context in varchar2);

--vecchia versione controllarne l'utilizzo
   function method(p_clob    in varchar2,
                   p_method  in varchar2,
                   p_context in varchar2)
     return varchar2;
--/vecchia versione

   procedure method(p_clob    in out clob,
                    p_method  in varchar2,
                    p_context in varchar2);

   procedure method(p_clob    in varchar2,
                    p_method  in varchar2,
                    p_context in varchar2,
                    p_out out clob);

end nodeoracle_gateway;
```

```
create or replace package body nodeoracle_gateway_min as

   procedure read_context(p_context in varchar2) is
   begin

      g_utente := pljson(p_context);

      -- other user operations
      
   end read_context;

   function read(p_clob    in varchar2,
                 p_model   in varchar2,
                 p_context in varchar2)
     return varchar2 is

      v_jsonl varchar2(32000);
      v_ret   varchar2(32000);

   begin

      read_context(p_context);

      execute immediate 'begin :json_list := ' || p_model || '.read(:x); end;'
        using out v_jsonl, in p_clob;

      return v_jsonl;

   end read;

   function read(p_id      in number,
                 p_model   in varchar2,
                 p_context in varchar2)
     return varchar2 is

      v_json varchar2(32000);
      v_ret  varchar2(32000);

   begin

      read_context(p_context);

      execute immediate 'begin :json := ' || p_model || '.read(:x); end;'
        using out v_json, p_id;

      return v_json;

   end read;

   procedure read(p_clob    in varchar2,
                  p_model   in varchar2,
                  p_context in varchar2,
                  p_out     out clob)
   is

      v_jsonl varchar2(32000);
      v_ret   clob;

   begin

      read_context(p_context);

      execute immediate 'begin ' || p_model || '.read(:x, :ret); end;'
        using in p_clob, out v_ret;

      p_out := v_ret;

   end read;

   procedure read(p_id      in number,
                  p_model   in varchar2,
                  p_context in varchar2,
                  p_out     out clob) is

      v_json varchar2(32000);
      v_ret  clob;

   begin

      read_context(p_context);

      execute immediate 'begin ' || p_model || '.read(:x, :ret); end;'
        using in p_id, out v_ret;

      p_out := v_ret;

   end read;

   procedure read(p_clob    in out clob,
                  p_model   in varchar2,
                  p_context in varchar2) is

      v_ret pljson_list;

   begin

      read_context(p_context);

      execute immediate 'begin ' || p_model || '.read(:x, :ret); end;'
        using in pljson(p_clob), out v_ret;

      if v_ret is not null then
         v_ret.to_clob(p_clob);
      end if;

   end read;

   procedure create_(p_clob    in clob,
                     p_model   in varchar2,
                     p_context in varchar2,
                     p_result  out clob) is

      v_ret_json varchar2(32000);

   begin

      read_context(p_context);

      execute immediate 'begin ' || p_model || '.create_(:x, :y); end;'
        using in p_clob, out v_ret_json;

      p_result:=v_ret_json;

   end create_;

   procedure update_(p_id      in number,
                     p_clob    in varchar2,
                     p_model   in varchar2,
                     p_context in varchar2,
                     p_result  out varchar2) is

      v_json pljson := pljson_Parser.parser(p_clob);
      v_ret varchar2(32000);

   begin

      read_context(p_context);

      v_ret := v_json.to_char();

      execute immediate 'begin ' || p_model || '.update_(:x, :y); end;'
        using p_id, in out v_ret;

      p_result:= v_ret;

   end update_;

   procedure delete_(p_id      in number,
                     p_model   in varchar2,
                     p_context in varchar2) is
   begin

      read_context(p_context);

      execute immediate 'begin ' || p_model || '.delete_(:x); end;'
        using p_id;

   end delete_;

   function method(p_clob    in varchar2,
                   p_method  in varchar2,
                   p_context in varchar2)
     return varchar2 is

      v_ret varchar2(32000);

   begin

      read_context(p_context);

      execute immediate 'begin :ret := ' || p_method || '(:x); end;'
        using out v_ret, in p_clob;

      return v_ret;

   end method;

   procedure method(p_clob    in varchar2,
                    p_method  in varchar2,
                    p_context in varchar2,
                    p_out     out clob) is

      v_ret clob;

   begin

      read_context(p_context);
      
      execute immediate 'begin ' || p_method || '(:x, :ret); end;'
        using in p_clob, out v_ret;

      p_out := v_ret;

   end method;

   procedure method(p_clob    in out clob,
                    p_method  in varchar2,
                    p_context in varchar2) is

      v_ret clob;

   begin

      read_context(p_context);

      execute immediate 'begin ' || p_method || '(:x, :ret); end;'
        using in p_clob, out v_ret;

   end method;

end nodeoracle_gateway_min;
```

## plsql packages : entity packages

TODO