import * as JSZip from 'jszip';

import API from '../../API';
import { getZip } from '../../helpers/getZip';
import { DynamicContent } from '../DynamicContent/DynamicContent';
import { RichMediaExpander } from '../RichMediaExpander/RichMediaExpander';
import { ExternalResources } from '../ExternalResources/ExternalResources';


export class RichMedia {
  private readonly PW: API;
  private readonly url: string;
  private readonly expanders: string[];

  constructor(url: string, PW: API, expanders: string[]) {
    this.url = url;
    this.PW = PW;
    this.expanders = expanders;
  }

  public async getContent() {
    const { result: { Language: language } } = await this.PW.getTags();
    const jszip = await getZip(this.url);

    if (!jszip.files['index.html']) {
      throw new Error('Can\'t find index.html');
    }

    if (!jszip.files['pushwoosh.json']) {
      throw new Error('Can\'t find pushwoosh.json');
    }

    const values = JSON.parse(await jszip.file('pushwoosh.json').async('text'));

    // get content from index.html file
    let content = await jszip.file('index.html').async('text');

    // need update dynamic content first because search patterns in external resources
    // can't work with dynamic content.
    // then update external resources, but in external resources may be dynamic content -> update dynamic content
    // flow:
    // update dynamic content -> update external resources -> update dynamic content


    // update dynamic content
    content = new DynamicContent(content, values, language).getReplacedContent();

    // load external resources
    content = await new ExternalResources(content, jszip).getReplacedContent();

    // update dynamic content
    content = new DynamicContent(content, values, language).getReplacedContent();

    // add pushManager and pushwoosh to content
    content = new RichMediaExpander(content, this.expanders).uploadExpanders();

    return content;
  };
}
