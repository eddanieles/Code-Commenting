/*global jQuery, Handlebars, Router */
jQuery(function ($) { //the same as $(document).ready
  'use strict'; //assist with the declaration of global variables

  Handlebars.registerHelper('eq', function (a, b, options) {
    return a === b ? options.fn(this) : options.inverse(this);
  });

  //defines a function at the beginning of the document that can be called later

  var ENTER_KEY = 13;
  var ESCAPE_KEY = 27;
  //giving variables to the keystrokes

  var ajax = {
    baseUrl: 'https://fathomless-woodland-51903.herokuapp.com/todos',
    headers: {
      'Authorization': 'Token token=supadupasecret'
    },
    getJSON: function (callback) {
      $.getJSON({
        url: this.baseUrl,
        headers: this.headers,
        success: function (response) {
          callback(response.data)
        }
      })
    }, //get request to the server
    create: function (value, callback) {
      $.post({
        url: this.baseUrl,
        headers: this.headers,
        data: { todo: { todo: value } },
        success: function (response) {
          callback(response.data)
        }
      })
    }, //post items to the server
    destroy: function (todo) {
      if(todo.id.includes('-'))
        return;
      $.ajax({
        type: "DELETE",
        url: `${this.baseUrl}/${todo.id}`,
        headers: this.headers
      });
    }, //deletes items from the server
    update: function (todo) {
      if(todo.id.includes('-'))
        return;
      $.ajax({
        type: "PUT",
        url: `${this.baseUrl}/${todo.id}`,
        headers: this.headers,
        data: {
          todo: {
            todo: todo.title,
            isComplete: todo.completed
          }
        }
      }); //updates items to the server
    }
  };

  var util = { //creates an object util
    uuid: function () {
      /*jshint bitwise:false */
      var i, random;
      var uuid = ''; //declaring the variable uuid as a string

      for (i = 0; i < 32; i++) {
        random = Math.random() * 16 | 0;
        if (i === 8 || i === 12 || i === 16 || i === 20) {
          uuid += '-';
        }
        uuid += (i === 12 ? 4 : (i === 16 ? (random & 3 | 8) : random)).toString(16);
      }

      return uuid; //returning a unique ID that is 36 characters long
    },
    pluralize: function (count, word) {
      return count === 1 ? word : word + 's';
    }, //adds s to the end of the word if count is not equal to 1
    store: function (namespace, data) {
      if (arguments.length > 1) {
        return localStorage.setItem(namespace, JSON.stringify(data));
      }
      else {
        var store = localStorage.getItem(namespace);
        return (store && JSON.parse(store)) || [];
      }
    }
  }; //end of util object

  var App = { //creates App object
    init: function () {
      this.todos = util.store('todos-jquery'); //returns the value of the position of util
      this.todoTemplate = Handlebars.compile($('#todo-template').html()); //grab the html of #todo-template
      this.footerTemplate = Handlebars.compile($('#footer-template').html()); //grab the html of #footer-template
      this.bindEvents(); //executes the bind function
      ajax.getJSON(this.integrateList.bind(this)); //using the integrateList method on this (init)

      var router = new Router({
        '/:filter': (filter) => this.renderFiltered(filter)
      })
      router.init('/all');
    },
    bindEvents: function () {
      $('#new-todo').on('keyup', e => this.create(e));
      $('#toggle-all').on('change', e => this.toggleAll(e));
      $('#footer').on('click', '#clear-completed', e => destroyCompleted(e));
      $('#todo-list')
      .on('change', '.toggle', e => this.toggle(e))
        .on('dblclick', 'label', e => this.edit(e))
        .on('keyup', '.edit', e => this.editKeyup(e))
        .on('focusout', '.edit', e => this.update(e))
        .on('click', '.destroy', e => this.destroy(e));
    }, //applying the keystrokes to the #todo-list
    renderFiltered: function(filter){
      this.filter = filter;
      this.render();
    },
    render: function () {
      var todos = this.getFilteredTodos();
      $('#todo-list').html(this.todoTemplate(todos)); //place html of the todoTemplate(todos) in #todo-list
      $('#main').toggle(todos.length > 0);
      $('#toggle-all').prop('checked', this.getActiveTodos().length === 0); //grabs the value of 'checked'
      this.renderFooter();
      $('#new-todo').focus(); //switch the event handler to #new-todo
      util.store('todos-jquery', this.todos); //hold the value of todos-jquery
    },
    renderFooter: function () {
      var todoCount = this.todos.length;
      var activeTodoCount = this.getActiveTodos().length;
      var template = this.footerTemplate({
        activeTodoCount: activeTodoCount,
        activeTodoWord: util.pluralize(activeTodoCount, 'item'),
        completedTodos: todoCount - activeTodoCount,
        filter: this.filter
      });

      $('#footer').toggle(todoCount > 0).html(template);
    }, //App.renderFooter is changing the template based on how many todos
    toggleAll: function (e) {
      var isChecked = $(e.target).prop('checked'); //changes the prop to the targetted item to checked

      this.todos.forEach(todo => {
        todo.completed = isChecked;
        ajax.update(todo);
      }); //checking each To Do and updating the server

      this.render();
    },
    getActiveTodos: function () {
      return this.todos.filter(todo => !todo.completed);
    }, //returns all todos that are not complete
    getCompletedTodos: function () {
      return this.todos.filter(todo => todo.completed);
    }, //returns all todos that are completed
    getFilteredTodos: function () {
      if (this.filter === 'active') {
        return this.getActiveTodos();
      }

      if (this.filter === 'completed') {
        return this.getCompletedTodos();
      }

      return this.todos;
    }, //when your on the Active or completed it allows the user to complete
    destroyCompleted: function () {
      this.getCompletedTodos().forEach(todo => ajax.destroy(todo));
      this.todos = this.getActiveTodos();
      this.filter = 'all';
      this.render();
    }, //removes the To Do from the server and webpage
    // accepts an element from inside the `.item` div and
    // returns the corresponding index in the `todos` array
    indexFromEl: function (el) {
      var id = String($(el).closest('li').data('id'));
      var todos = this.todos;
      var i = todos.length;

      while (i--) {
        if (todos[i].id === id) {
          return i;
        }
      }
    }, //allows to the user to get the ID of the To Do
    create: function (e) { //create a new To Do
      var $input = $(e.target);
      var val = $input.val().trim();

      if (e.which !== ENTER_KEY || !val) {
        return;
      } //doesn't allow for the input a null value

      var uuid = util.uuid(); //adds ID to To Do
      this.integrate(uuid, val); //uses the integrate function
      ajax.create(val, this.replace(uuid, this));

      $input.val('');

      this.render();
    },
    replace: (oldId, context) => {
      return (newTodo) => {
        var todo = context.todos.find((todo) => todo.id === oldId);
        todo.id = newTodo.id;
        util.store('todos-jquery', context.todos); //holds on to the context of the user's input
      }
    },
    toggle: function (e) { //looking for a change to the complete status on the To Do
      var i = this.indexFromEl(e.target);
      var todo = this.todos[i];
      todo.completed = !todo.completed;
      ajax.update(todo); //updates the server
      this.render();
    },
    edit: function (e) {
      var $input = $(e.target).closest('li').addClass('editing').find('.edit');
      $input.val($input.val()).focus();
    },
    editKeyup: function (e) {
      if (e.which === ENTER_KEY) {
        e.target.blur(); //loses focus
      }

      if (e.which === ESCAPE_KEY) {
        $(e.target).data('abort', true).blur(); //loses focus when the ESCAPE_KEY is press
      }
    },
    update: function (e) {
      var el = e.target;
      var $el = $(el);
      var val = $el.val().trim(); //removes whitespace of the value inputted

      if (!val) {
        this.destroy(e);
        return;
      } //disables users from inputting a blank value

      if ($el.data('abort')) {
        $el.data('abort', false);
      } else {
        var todo = this.todos[this.indexFromEl(el)];
        todo.title = val;
        ajax.update(todo);
      }

      this.render();
    },
    destroy: function (e) {
      var todo = this.todos.splice(this.indexFromEl(e.target), 1)[0];
      ajax.destroy(todo);
      this.render();
    }, //removes the To Do from the server
    notIntegrated: function (todo) {
      return !this.todos.map((todo) => todo.id).includes(todo.id);
    }, //returns true or false if the ID is included
    integrate: function (id, title, completed) {
      this.todos.push({
        id: id,
        title: title,
        completed: completed || false
      });
    }, //pushed the To Do object to the todos array
    integrateList: function (data) {
      data.filter((todo) => this.notIntegrated(todo)) //returns an array of To Dos that aren't intergrated
          .forEach(todo => this.integrate(todo.id,
                                          todo.attributes.id,
                                          todo.attributes['is-complete']));
      this.render();
    }
  }; //end of App object

  App.init();
});
