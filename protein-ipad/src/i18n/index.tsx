import { createContext, useContext, useEffect, useState, cloneElement, isValidElement } from 'react';
import type { ReactNode, ReactElement } from 'react';
import { zh } from './zh';
export type Language='en'|'zh-CN';
const Context=createContext<{language:Language;setLanguage:(value:Language)=>void}>({language:'en',setLanguage:()=>{}});
export function I18nProvider({children}:{children:ReactNode}){
 const [language,setLanguage]=useState<Language>(()=>{try{const saved=localStorage.getItem('protein-language');if(saved==='en'||saved==='zh-CN')return saved;}catch{/* Storage can be unavailable in private sessions. */}return navigator.language.toLowerCase().startsWith('zh')?'zh-CN':'en';});
 useEffect(()=>{document.documentElement.lang=language;document.title=language==='zh-CN'?'Protein · 分子结构查看器':'Protein · Molecular viewer';try{localStorage.setItem('protein-language',language);}catch{/* The switch still works without persistence. */}},[language]);
 return <Context.Provider value={{language,setLanguage}}>{children}</Context.Provider>;
}
export const useI18n=()=>useContext(Context);
const patterns=Object.entries(zh).filter(([key])=>key.includes('{')).map(([key,value])=>({regex:new RegExp('^'+key.split(/(\{\w+\})/).map(part=>/^\{\w+\}$/.test(part)?'(.+?)':part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('')+'$'),key,value}));
export function translate(text:string,language:Language):string{
 if(language==='en')return text;
 const core=text.trim();let translated=zh[core];
 if(!translated)for(const pattern of patterns){const match=pattern.regex.exec(core);if(match){let i=0;const values:Record<string,string>={};for(const key of pattern.key.match(/\{\w+\}/g)||[])values[key]=match[++i];translated=pattern.value.replace(/\{\w+\}/g,key=>values[key]);break;}}
 return translated?text.replace(core,translated):text;
}
/** Translate rendered text and accessibility labels through React, without touching data, values or DOM nodes. */
export function localize(node:ReactNode,language:Language):ReactNode{
 if(language==='en')return node;
 if(typeof node==='string')return translate(node,language);
 if(Array.isArray(node))return node.map(child=>localize(child,language));
 if(!isValidElement(node))return node;
 const element=node as ReactElement<Record<string,unknown>>,props:Record<string,unknown>={};
 if(element.props.children!==undefined)props.children=localize(element.props.children as ReactNode,language);
 if(typeof element.type==='string')for(const key of ['aria-label','title','placeholder','alt'])if(typeof element.props[key]==='string')props[key]=translate(element.props[key] as string,language);
 return cloneElement(element,props);
}
