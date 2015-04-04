describe('Todo Demo', function () {


  beforeEach(function () {
    browser.get('/index.html');
  });

  it('should have proper title', function () {

    expect(browser.getTitle()).toEqual('Todo Module Demo');

  });

});