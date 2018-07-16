import Pushwoosh from '../src/Pushwoosh';
import {expect} from 'chai';


describe('Pushwoosh. Main SDK class', function() {
  it('should be initialized', function() {
    const pushwoosh = new Pushwoosh();
    const initParams = {
      applicationCode: 'TEST-CODE'
    };
    const expectedPushwooshInitParams = {...initParams};

    pushwoosh['init'](initParams);
    expect(expectedPushwooshInitParams).to.deep.equal(pushwoosh['_initParams']);
  });
});
