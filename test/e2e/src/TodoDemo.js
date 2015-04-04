describe('Todo Demo', () =>{


  beforeEach(() => {
    browser.get('/index.html');
  });

  it('should have proper title', () => {

    expect(browser.getTitle()).toEqual('Todo Module Demo');

  });

});