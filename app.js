var recast = require("recast");
var types = recast.types;
const crypto = require('crypto');

var n = types.namedTypes;
var b = types.builders;

var desugar = {

  "VERSION": "1.0.0",

  transform: (codeString, options=[]) => {
    var ast = recast.parse(codeString);
    var symbolTable = {};

    var scopeIdentifierTable = {};
    var paramTable = {};
    var localVarTable = {};

    var topScope = 'global';

    var scopeArray = ["global"];

    var topScopeFunctions = [];

    var default_options = {
      _compound_op_unfold: false,
      _type_conversion: false,
      _object_proto: false,
      _function_proto: false,
    };

    options.map(function(op) {
      if (default_options.hasOwnProperty(op)) {
        default_options[op] = true;
      }
    });

    function pushLocalVarTable(name) {
      var currentFunction = scopeArray[scopeArray.length - 1];
      if (localVarTable.hasOwnProperty(currentFunction) && localVarTable[currentFunction].indexOf(name) === -1) {
        localVarTable[currentFunction].push(name)
      } else if (!localVarTable.hasOwnProperty(currentFunction)) {
        localVarTable[currentFunction] = [name]
      }
    }

    function pushScopeIdentifierTable(name) {
      var currentFunction = scopeArray[scopeArray.length - 1];
      if (scopeIdentifierTable.hasOwnProperty(currentFunction) && scopeIdentifierTable[currentFunction].indexOf(name) === -1) {
        scopeIdentifierTable[currentFunction].push(name)
      } else if (!scopeIdentifierTable.hasOwnProperty(currentFunction)) {
        scopeIdentifierTable[currentFunction] = [name]
      }
    }

    function pushParamTable(name) {
      var currentFunction = scopeArray[scopeArray.length - 1];
      if (paramTable.hasOwnProperty(currentFunction) && paramTable[currentFunction].indexOf(name) === -1) {
        paramTable[currentFunction].push(name)
      } else if (!paramTable.hasOwnProperty(currentFunction)) {
        paramTable[currentFunction] = [name]
      }
    }

    function isLocalVar(name) {
      var currentFunction = scopeArray[scopeArray.length - 1];
      return localVarTable.hasOwnProperty(currentFunction) && localVarTable[currentFunction].indexOf(name) > -1;
    }

    function isParam(name) {
      var currentFunction = scopeArray[scopeArray.length - 1];
      return currentFunction !== topScope
        && paramTable.hasOwnProperty(currentFunction)
        && paramTable[currentFunction].indexOf(name) > -1
    }

    recast.visit(ast, {

      visitIdentifier: function(path) {
        var name = path.value.name;

        var currentFunction = scopeArray[scopeArray.length - 1];

        this.traverse(path)
      },

      visitObjectExpression: function(path) {
        
        if (!default_options['_object_proto']) {
          this.traverse(path);
          return;
        }

        if (path.value.properties.filter(function(p) {
          return p.key.name === '__proto__';
        }).length === 0) {
          path.value.properties.push(
            b.property(
              'init',
              b.identifier('__proto__'),
              b.memberExpression(
                b.identifier('Object'),
                b.identifier('prototype')
              )
            )
          )
        }

        this.traverse(path);

      },

      visitFunctionExpression: function(path) {
        var value = path.value;
        var name = value.id;

        scopeArray.push(name);

        this.traverse(path);

        scopeArray.pop();
      },

      visitFunctionDeclaration: function(path) {
        var value = path.value;
        var name = value.id.name;

        if (!default_options['_function_proto']) {
          this.traverse(path);
          return;
        }
        
        // insert a scope param
        value.params.unshift(b.identifier("this"))

        // path.replace(
        //   b.functionDeclaration(
        //     value.id,
        //     value.params,
        //     value.body,
        //     false,
        //     false
        //   )
        // )


        var code = b.property(
          'init',
          b.identifier('code'),
          b.functionExpression(
            null, value.params, value.body, false, true
          )
        );
        var proto = b.property(
          'init',
          b.identifier('prototype'),
          b.objectExpression(
          [b.property(
            'init',
            b.identifier('__proto__'),
            b.memberExpression(
              b.identifier('Object'),
              b.identifier('prototype')
            ))
          ]
        ));

        var dtor = b.variableDeclarator(
          b.identifier(name),
          b.objectExpression([code, proto])
        )

        path.replace(
          b.variableDeclaration(
            'var', [dtor]
          )
        )

        scopeArray.push(name);

        this.traverse(path);

        scopeArray.pop();
      },

      visitVariableDeclaration: function(path) {
        var value = path.value;
        var type = "";

        value.declarations.map(function(dec) {
          var key = dec.id.name;
          if (n.Literal.check(dec.init)) {
            type = typeof dec.init.value;
          }
          if (n.NewExpression.check(dec.init)) {
            type = 'object';
          }
          symbolTable[key] = type;
        })

        if (!default_options['_function_proto']) {
          this.traverse(path);
          return;
        }

        var newexp = value.declarations.filter(function(dec) {
          return dec.init.type === 'NewExpression';
        })

        if (newexp.length > 0) {
          var name = newexp[0].id.name;
          var constr_dtor = b.variableDeclarator(
            b.identifier('_constr'),
            b.identifier(newexp[0].init.callee.name)
          )
          var constr_exp = b.variableDeclaration('var', [constr_dtor]);

          var obj_dtor = b.variableDeclarator(
            b.identifier('_obj'),
            b.objectExpression(
              [b.property(
                'init',
                b.identifier('__proto__'),
                b.memberExpression(
                  b.identifier('_constr'),
                  b.literal('prototype')
                ))
              ]
            )
          )
          var obj_exp = b.variableDeclaration('var', [obj_dtor]);
          var memb_exp = b.memberExpression(
            b.identifier('_constr'),
            b.literal('code')
          );
          var args = newexp[0].init.arguments;
          args.unshift(b.identifier('_obj'));

          var call_exp = b.callExpression(memb_exp, args);
          var new_dtor = b.variableDeclarator(
            b.identifier(name),
            call_exp
          );

          var new_exp = b.variableDeclaration('var', [new_dtor]);

          path.replace(constr_exp, obj_exp, new_exp);
        }

        this.traverse(path);
      },

      visitBinaryExpression: function(path) {
        var exp = path.value;
        var node = path.node;
        var left, right;

        if (!default_options['_type_conversion']) {
          this.traverse(path);
          return;
        }

        if (n.Identifier.check(exp.left) && symbolTable[exp.left.name] === 'object') {
          left = b.callExpression(
            b.memberExpression(
              b.identifier(exp.left.name),
              b.identifier("valueOf"),
              false
            ), []
          )
        } else {
          left = exp.left;
        }

        if (n.Identifier.check(exp.right) && symbolTable[exp.right.name] === 'object') {
          right = b.callExpression(
            b.memberExpression(
              b.identifier(exp.right.name),
              b.identifier("valueOf"),
              false
            ), []
          )
        } else {
          right = exp.right;
        }

        path.replace(
          b.binaryExpression(
            exp.operator,
            left,
            right,
            exp.loc
          )
        )

        this.traverse(path);
      },

      visitAssignmentExpression: function(path) {

        if (!default_options['_compound_op_unfold']) {
          this.traverse(path);
          return;
        }

        var exp = path.value;
        var reg = /([\+\-\*\/\%\&\^\|]|\*\*|<<|>>|>>>)=/;
        if (reg.test(exp.operator)) {
          var op = exp.operator.match(reg)[1];
          var right = b.binaryExpression(
            op,
            exp.left,
            exp.right,
            exp.loc
          );
          path.replace(
            b.assignmentExpression(
              "=",
              exp.left,
              right,
              exp.loc
            )
          )
        }

        this.traverse(path);
      }
    });

    // console.log("reference: ", scopeIdentifierTable)
    // console.log("param: ", paramTable)
    // console.log("local: ", localVarTable)
    // console.log('top scope functions: ', topScopeFunctions.toString())
    console.log(recast.print(ast).code)
    return recast.print(ast).code;
  }
};

global.desugar = desugar;
module.exports = desugar;
